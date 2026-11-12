import { readdir, readFile } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import { normalizePath } from "vite";
import { parse } from "yaml";
import { profile } from "../profile.js";
import { articleMarkup, escapeHtml, pageTitle, profileMarkup, projectsMarkup } from "./markup.js";
import { postSlug, readRoute, routePath, sortPosts, workspaces } from "./routes.js";

const postsDirectory = new URL("../content/posts/", import.meta.url);
const postsPath = normalizePath(fileURLToPath(postsDirectory));
const markdown = new MarkdownIt({ html: false });

function compilePost(slug, source) {
  const frontMatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!postSlug.test(slug) || !frontMatter) {
    throw new Error(`${slug}.md 需要使用英文文件名和 YAML front matter`);
  }

  const { title, date, description, tags = [] } = parse(frontMatter[1]) ?? {};
  if (typeof title !== "string" || !title.trim() || typeof description !== "string" || !description.trim()
      || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || !Array.isArray(tags) || tags.some((tag) => typeof tag !== "string" || !tag.trim())) {
    throw new Error(`${slug}.md 的 title、date、description 或 tags 格式不正确`);
  }
  const env = {};
  const tokens = markdown.parse(source.slice(frontMatter[0].length), env);
  const headings = [];
  for (const [index, token] of tokens.entries()) {
    if (token.type !== "heading_open" || token.level !== 0) continue;
    const inline = tokens[index + 1];
    const label = inline.children.map(({ content }) => content).join("").trim();
    if (!label) continue;
    const id = `post-${slug}-${headings.length + 1}`;
    token.attrSet("id", id);
    headings.push({ id, label, level: Number(token.tag.slice(1)) });
  }
  const html = markdown.renderer.render(tokens, markdown.options, env);
  if (!html.trim()) throw new Error(`${slug}.md 缺少正文`);
  return { slug, title: title.trim(), date, description: description.trim(), tags, html, headings, source };
}

async function loadPosts() {
  const files = await readdir(postsDirectory, { withFileTypes: true });
  const posts = await Promise.all(files.filter((file) => file.isFile() && file.name.endsWith(".md")).map(async ({ name }) =>
    compilePost(basename(name, ".md"), await readFile(new URL(name, postsDirectory), "utf8"))));
  return sortPosts(posts);
}

function renderPage(template, route, posts, interests) {
  const path = routePath(route);
  const base = path ? "../".repeat(path.split("/").length - 1) : "./";
  const hrefFor = (path) => base + path;
  const post = posts.find(({ slug }) => slug === route.slug);
  const title = pageTitle(route, post);
  const nav = workspaces.map(({ id, label, path }) =>
    `<a href="${hrefFor(path)}"${id === route.workspace ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  const list = posts.map((item) => `<li><a href="${hrefFor(routePath({ workspace: "articles", slug: item.slug }))}">${escapeHtml(item.title)}</a>
    <time datetime="${item.date}">${item.date}</time></li>`).join("");
  let content;
  if (post) content = articleMarkup(post);
  else if (route.workspace === "about") {
    content = `${profileMarkup(interests)}${projectsMarkup()}`;
  } else {
    content = `<div class="static-index"><h1>${route.workspace === "home" ? profile.name : "文章"}</h1><ul>${list}</ul></div>`;
  }
  const description = post?.description ?? profile.about;

  return template
    .replace(/<meta name="site-root" content="[^"]*">/, `<meta name="site-root" content="${base}">`)
    .replace(/(src|href)="\.\/assets\//g, `$1="${base}assets/`)
    .replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${escapeHtml(description)}">`)
    .replace("<body>", '<body class="has-static-page">')
    .replace("<!-- static-page -->", () => `<main class="static-page" id="static-page">
      <div class="static-inner"><nav class="static-nav" aria-label="页面">${nav}</nav>${content}</div>
    </main>`);
}

export function blogPages() {
  return {
    name: "felix-blog",
    enforce: "pre",
    configurePreviewServer({ config, middlewares }) {
      const basePath = config.base.startsWith("/") ? config.base : "/";
      middlewares.use((request, response, next) => {
        if (!request.url || !["GET", "HEAD"].includes(request.method)) return next();
        const url = new URL(request.url, "http://localhost");
        if (url.pathname.endsWith("/")) return next();
        const route = readRoute(url.pathname, basePath);
        if (!route) return next();
        const path = routePath(route);
        if (!path || url.pathname !== basePath + path.slice(0, -1)) return next();
        response.writeHead(308, { Location: basePath + path + url.search });
        response.end();
      });
    },
    transform(source, id) {
      if (!id.startsWith(postsPath) || !id.endsWith(".md")) return;
      const post = compilePost(basename(id, ".md"), source);
      return { code: `export default ${JSON.stringify(post)};`, map: null };
    },
    generateBundle: {
      order: "post",
      async handler(_, bundle) {
        const index = bundle["index.html"];
        if (index?.type !== "asset" || typeof index.source !== "string") {
          this.error("缺少可用的 index.html，无法生成博客页面");
        }
        const template = index.source;
        const [posts, interestsText] = await Promise.all([
          loadPosts(),
          readFile(new URL("../public/interests.json", import.meta.url), "utf8"),
        ]);
        const interests = JSON.parse(interestsText);
        index.source = renderPage(template, { workspace: "home" }, posts, interests);

        const pages = [
          { workspace: "articles" },
          { workspace: "about" },
          ...posts.map(({ slug }) => ({ workspace: "articles", slug })),
        ];
        for (const route of pages) {
          this.emitFile({
            type: "asset",
            fileName: `${routePath(route)}index.html`,
            source: renderPage(template, route, posts, interests),
          });
        }
      },
    },
  };
}
