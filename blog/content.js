import { routePath, sortPosts } from "./routes.js";

const rootPath = document.querySelector('meta[name="site-root"]').content;
export const siteBase = new URL(rootPath, location.href);

export const posts = sortPosts(Object.values(import.meta.glob("../content/posts/*.md", { eager: true, import: "default" })));
export const postBySlug = new Map(posts.map((post) => [post.slug, post]));
export const hrefFor = (path) => new URL(path, siteBase).href;
export const postHref = (slug) => hrefFor(routePath({ workspace: "articles", slug }));
