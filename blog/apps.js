import { hrefFor, postHref, posts, siteBase } from "./content.js";
import { articleMarkup, escapeHtml, interestsMarkup, postMeta, profileMarkup, projectsMarkup } from "./markup.js";
import { mountReaderOutline } from "./reader-outline.js";
import { searchPosts } from "./search.js";

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
    const years = new Map();
    for (const post of searchPosts(posts, search.value)) {
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

export function mountReader(root, { windowId }) {
  root.classList.add("reader-body");
  const scroll = document.createElement("div");
  scroll.className = "reader-scroll";
  scroll.dataset.scroll = "";
  root.append(scroll);
  const setHeadings = mountReaderOutline(scroll, windowId);
  scroll.addEventListener("click", async (event) => {
    const button = event.target.closest(".post-code-copy");
    if (!button || !scroll.contains(button)) return;
    const code = button.closest(".post-code").querySelector("pre code");
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.textContent);
      button.textContent = "已复制";
    } catch {
      button.textContent = "复制失败";
    }
    clearTimeout(button.copyTimer);
    button.copyTimer = setTimeout(() => { button.textContent = "复制"; }, 1800);
  });
  let current;

  return {
    show(post, requestedSlug) {
      const key = post?.slug ?? requestedSlug ?? "";
      if (key === current) return;
      current = key;
      if (post) {
        scroll.innerHTML = articleMarkup(post, windowId, siteBase.href);
        if (navigator.clipboard?.writeText) {
          for (const button of scroll.querySelectorAll(".post-code-copy")) button.hidden = false;
        }
      }
      else {
        scroll.innerHTML = `<p class="reader-empty">${requestedSlug ? "找不到文章" : "暂无文章"}</p>`;
      }
      scroll.scrollTop = 0;
      setHeadings(post?.headings ?? []);
    },
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
  root.innerHTML = projectsMarkup();
}
