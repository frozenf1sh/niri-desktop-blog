import { hrefFor, postHref, posts } from "./content.js";
import { articleMarkup, escapeHtml, interestsMarkup, postMeta, profileMarkup, projectsMarkup } from "./markup.js";

export function mountArchive(root) {
  root.classList.add("archive-body");
  root.innerHTML = `<div class="archive-toolbar">
    <input type="search" aria-label="搜索文章" placeholder="搜索文章" autocomplete="off">
  </div><div class="archive-list" data-scroll></div>`;
  const search = root.querySelector("input");
  const list = root.querySelector(".archive-list");
  let selected;

  function highlight() {
    for (const link of list.querySelectorAll("[data-post]")) {
      if (link.dataset.post === selected) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }

  function render() {
    const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const years = new Map();
    for (const post of posts) {
      const text = [post.title, post.description, ...post.tags].join(" ").toLocaleLowerCase();
      if (!terms.every((term) => text.includes(term))) continue;
      const year = post.date.slice(0, 4);
      if (!years.has(year)) years.set(year, []);
      years.get(year).push(post);
    }
    list.innerHTML = [...years].map(([year, articles]) => `<section class="archive-year">
      <h3>${year}</h3>
      <ul>${articles.map((post) => `<li>
        <a class="archive-entry" data-blog-link data-post="${post.slug}" href="${escapeHtml(postHref(post.slug))}">
          <span class="archive-title">${escapeHtml(post.title)}</span>
          <span class="post-meta">${postMeta(post)}</span>
        </a>
      </li>`).join("")}</ul>
    </section>`).join("") || '<p class="archive-empty">没有匹配的文章</p>';
    highlight();
  }

  search.addEventListener("input", () => {
    render();
    list.scrollTop = 0;
  });
  render();
  return {
    select(slug) {
      selected = slug;
      highlight();
    },
    capture: () => search.value,
    restore(value) {
      if (search.value === value) return;
      search.value = value;
      render();
    },
  };
}

export function mountReader(root) {
  root.classList.add("reader-body");
  let current;
  return {
    show(post, requestedSlug) {
      const key = post?.slug ?? requestedSlug ?? "";
      if (key === current) return;
      current = key;
      if (post) root.innerHTML = articleMarkup(post);
      else {
        root.innerHTML = `<p class="reader-empty">${requestedSlug ? "找不到文章" : "暂无文章"}</p>`;
      }
      root.scrollTop = 0;
    },
    focus: () => root.querySelector("h1")?.focus({ preventScroll: true }),
  };
}

export function mountProfile(root) {
  root.innerHTML = profileMarkup();
  const topics = root.querySelector(".profile-topics");
  fetch(hrefFor("interests.json"))
    .then((response) => response.ok ? response.json() : [])
    .then((interests) => {
      if (Array.isArray(interests) && interests.length) topics.innerHTML = interestsMarkup(interests);
    })
    .catch(() => {});
}

export function mountProjects(root) {
  root.innerHTML = projectsMarkup(posts, hrefFor);
}
