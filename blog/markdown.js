import MarkdownIt from "markdown-it";
import container from "markdown-it-container";
import markdownItShiki from "@shikijs/markdown-it";
import { parse } from "yaml";
import { escapeHtml } from "./markup.js";
import { postSlug } from "./routes.js";

const markdown = new MarkdownIt({ html: true });
markdown.use(await markdownItShiki({
  theme: "github-dark",
  langs: ["javascript", "typescript", "json", "bash", "shellscript", "go", "rust", "python", "java", "c", "cpp", "csharp", "css", "html", "xml", "yaml", "toml", "sql", "diff", "dockerfile", "markdown"],
  fallbackLanguage: "text",
  trimEndingNewline: false,
}));

for (const [kind, label] of Object.entries({ note: "提示", tip: "小贴士", warning: "注意", danger: "警告" })) {
  markdown.use(container, kind, {
    render(tokens, index) {
      if (tokens[index].nesting === -1) return "</div>\n";
      const title = tokens[index].info.trim().slice(kind.length).trim() || label;
      return `<div class="post-callout post-callout-${kind}"><div class="post-callout-title">${escapeHtml(title)}</div>\n`;
    },
  });
}

const renderFence = markdown.renderer.rules.fence;
markdown.renderer.rules.fence = (tokens, index, options, env, renderer) => {
  const language = tokens[index].info.trim().split(/\s+/)[0] || "text";
  const highlighted = renderFence(tokens, index, options, env, renderer);
  return `<div class="post-code"><div class="post-code-bar"><span>${escapeHtml(language)}</span><button type="button" class="post-code-copy" hidden>复制</button></div>${highlighted}</div>\n`;
};
markdown.renderer.rules.table_open = () => '<div class="post-table-wrap" tabindex="0" role="region" aria-label="表格，可横向滚动"><table>\n';
markdown.renderer.rules.table_close = () => '</table></div>\n';

function rewriteImages(tokens, slug) {
  for (const token of tokens) {
    if (token.type === "image") {
      const src = token.attrGet("src");
      if (src && !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(src)) {
        const base = new URL(`https://local.invalid/post-assets/${slug}/`);
        const url = new URL(src, base);
        if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
          throw new Error(`${slug}.md 的图片路径必须位于对应的文章图片目录`);
        }
        token.attrSet("src", `__POST_SITE_ROOT__${url.pathname.slice(1)}${url.search}${url.hash}`);
      }
      token.attrSet("loading", "lazy");
    }
    if (token.children) rewriteImages(token.children, slug);
  }
}

export function compilePost(slug, source) {
  const frontMatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!postSlug.test(slug) || !frontMatter) throw new Error(`${slug}.md 需要使用英文文件名和 YAML front matter`);
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
    const label = tokens[index + 1].children.map(({ content }) => content).join("").trim();
    if (!label) continue;
    const id = `post-${slug}-${headings.length + 1}`;
    token.attrSet("id", id);
    headings.push({ id, label, level: Number(token.tag.slice(1)) });
  }
  rewriteImages(tokens, slug);
  const html = markdown.renderer.render(tokens, markdown.options, env);
  if (!html.trim()) throw new Error(`${slug}.md 缺少正文`);
  return { slug, title: title.trim(), date, description: description.trim(), tags, html, headings, source };
}
