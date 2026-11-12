import { hrefFor, postHref, posts } from "./content.js";
import { articleMarkup, escapeHtml, interestsMarkup, postMeta, profileMarkup, projectsMarkup } from "./markup.js";
import { searchPosts } from "./search.js";
import { icon } from "../icons.js";

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

export function mountReader(root, { actions }) {
  root.classList.add("reader-body");
  const toggle = document.createElement("button");
  toggle.className = "icon-button outline-toggle";
  toggle.type = "button";
  toggle.innerHTML = icon("list");
  toggle.setAttribute("aria-label", "目录");
  toggle.setAttribute("aria-controls", "reader-outline");
  toggle.hidden = true;
  actions.prepend(toggle);

  const outline = document.createElement("nav");
  outline.id = "reader-outline";
  outline.className = "reader-outline";
  outline.setAttribute("aria-label", "文章目录");
  outline.inert = true;
  root.after(outline);

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let outlineOpen = false;
  let sections = [];
  let current;
  let scrollFrame = 0;

  function updateSection() {
    if (!outlineOpen || !sections.length) return;
    const top = root.getBoundingClientRect().top;
    let active = sections[0];
    for (const section of sections) {
      if (section.heading.getBoundingClientRect().top <= top + 54) active = section;
    }
    if (root.scrollTop > 0 && root.scrollHeight - root.clientHeight - root.scrollTop < 2) active = sections.at(-1);
    for (const section of sections) {
      if (section === active) section.button.setAttribute("aria-current", "location");
      else section.button.removeAttribute("aria-current");
    }
  }

  function setOutline(open) {
    outlineOpen = open;
    const visible = open && sections.length > 0;
    outline.classList.toggle("is-open", visible);
    outline.inert = !visible;
    toggle.setAttribute("aria-expanded", String(visible));
    toggle.title = visible ? "收起目录" : "打开目录";
    updateSection();
  }

  function buildOutline(headings) {
    sections = headings.map(({ id, label, level }) => {
      const heading = root.querySelector(`#${id}`);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.style.setProperty("--outline-indent", Math.max(0, level - 2));
      button.addEventListener("click", () => {
        const top = root.scrollTop + heading.getBoundingClientRect().top - root.getBoundingClientRect().top - 16;
        if (root.clientWidth < 520) setOutline(false);
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        root.scrollTo({ top, behavior: reduceMotion.matches ? "instant" : "smooth" });
      });
      return { heading, button };
    });
    outline.replaceChildren(...sections.map(({ button }) => button));
    toggle.hidden = sections.length === 0;
    setOutline(outlineOpen);
  }

  toggle.addEventListener("click", (event) => {
    setOutline(!outlineOpen);
    if (outlineOpen && event.detail === 0) {
      (outline.querySelector('[aria-current="location"]') ?? sections[0]?.button)?.focus({ preventScroll: true });
    }
  });
  root.addEventListener("pointerdown", () => {
    if (outlineOpen) setOutline(false);
  });
  root.parentElement.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || outline.inert) return;
    event.preventDefault();
    setOutline(false);
    toggle.focus({ preventScroll: true });
  });
  root.addEventListener("scroll", () => {
    if (scrollFrame || !outlineOpen) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      updateSection();
    });
  }, { passive: true });

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
      buildOutline(post?.headings ?? []);
    },
    focus: () => root.querySelector("h1")?.focus({ preventScroll: true }),
    capture: () => outlineOpen,
    restore: (open) => setOutline(open),
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
