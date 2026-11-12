export const workspaces = [
  { id: "home", label: "首页", path: "", apps: ["files", "terminal", "music"], utilities: ["notes", "calendar"] },
  { id: "articles", label: "文章", path: "articles/", apps: ["archive", "reader"] },
  { id: "about", label: "关于", path: "about/", apps: ["profile", "projects"] },
];

export const postSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function routePath({ workspace, slug }) {
  if (workspace === "articles" && slug) return `articles/${slug}/`;
  return workspaces.find(({ id }) => id === workspace).path;
}

export function readRoute(pathname, basePath) {
  if (pathname === basePath.slice(0, -1)) return { workspace: "home" };
  if (!pathname.startsWith(basePath)) return null;

  const path = pathname.slice(basePath.length).replace(/(^|\/)index\.html$/, "").replace(/\/$/, "");
  const workspace = workspaces.find((space) => space.path.replace(/\/$/, "") === path);
  if (workspace) return { workspace: workspace.id };

  const [section, slug, extra] = path.split("/");
  if (section === "articles" && postSlug.test(slug ?? "") && extra === undefined) {
    return { workspace: "articles", slug };
  }
  return null;
}

export function sortPosts(posts) {
  return posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}
