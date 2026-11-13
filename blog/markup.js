import { profile } from "../profile.js";

const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => entities[ch]);

export function pageTitle({ workspace, slug }, post) {
  if (workspace === "home") return `${profile.name} · 桌面`;
  if (workspace === "about") return `关于 · ${profile.name}`;
  const title = slug ? post?.title ?? "找不到文章" : "文章";
  return `${title} · ${profile.name}`;
}

export function postMeta(post) {
  return `<time datetime="${post.date}">${post.date}</time>${
    post.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")
  }`;
}

export function articleMarkup(post, windowId) {
  const html = windowId
    ? post.html.replace(/(id="|href="#)(post-[a-z0-9-]+)"/g, `$1${windowId}-$2"`)
    : post.html;
  return `<article class="post">
    <header class="post-header">
      <div class="post-meta">${postMeta(post)}</div>
      <h1 tabindex="-1">${escapeHtml(post.title)}</h1>
    </header>
    <div class="post-body">${html}</div>
  </article>`;
}

export function interestsMarkup(interests) {
  return `<h2>兴趣</h2><ul class="profile-interests">${interests.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

export function profileMarkup(interests = []) {
  return `<div class="profile-content">
    <h1>${escapeHtml(profile.name)}</h1>
    <span class="profile-host">${escapeHtml(profile.hostname)}</span>
    <p>${escapeHtml(profile.about)}</p>
    <div class="profile-topics">${interests.length ? interestsMarkup(interests) : ""}</div>
  </div>`;
}

export function projectsMarkup() {
  return `<div class="project-content">
    <h2><a class="project-link" href="https://github.com/frozenf1sh/niri-desktop-blog" target="_blank" rel="noopener noreferrer">niri-desktop-blog</a></h2>
    <p>受 niri 启发的个人博客。文件和终端留在桌面，文章在独立的工作区里阅读。</p>
    <div class="post-meta"><span>JavaScript</span><span>Vite</span></div>
  </div>`;
}
