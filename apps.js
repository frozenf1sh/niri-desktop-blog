import { mountArchive, mountProfile, mountProjects, mountReader } from "./blog/apps.js";
import { postHref, posts, siteBase } from "./blog/content.js";
import { escapeHtml } from "./blog/markup.js";
import { icon } from "./icons.js";
import { readSetting, writeSetting } from "./settings.js";
import { mountTerminal } from "./terminal/view.js";

const locations = [
  { id: "home", name: "主文件夹", icon: "home" },
  { id: "articles", name: "文章", icon: "file", color: "#c8aff7" },
  { id: "docs", name: "文档", icon: "file", color: "#c8aff7" },
  { id: "pictures", name: "图片", icon: "image", color: "#e2b3d7" },
  { id: "music", name: "音乐", icon: "music", color: "#dbafd7" },
];

const wallpaper = { name: "暮色海湾.webp", id: "wallpaper" };
const noteFile = { name: "便笺.txt", id: "notes" };
const wallpaperUrl = new URL("./assets/dusk.webp", import.meta.url).href;

function mountFiles(root, { openApp, player }) {
  const folderButton = ({ id, name, color }, asFile = false) =>
    `<button class="file-item${asFile ? " recent-item" : ""}" type="button" data-go="${id}" style="--folder-color:${color}">${asFile ? `<span class="file-thumb">${icon("folder-fill")}</span>` : icon("folder-fill")}<span>${name}</span></button>`;
  const fileButton = ({ id, name }) => `<button class="file-item recent-item" type="button" data-file="${id}" title="${name}">
    ${id === "wallpaper" ? `<img class="file-thumb" src="${wallpaperUrl}" alt="">` : `<span class="file-thumb">${icon("file")}</span>`}
    <span>${name}</span></button>`;
  const musicButton = ({ id, fileName }) => `<button class="file-item recent-item" type="button" data-track="${escapeHtml(id)}" title="${escapeHtml(fileName)}">
    <span class="file-thumb">${icon("music")}</span><span>${escapeHtml(fileName)}</span></button>`;
  const postLink = (post) => `<a class="file-item recent-item post-file" data-blog-link href="${escapeHtml(postHref(post.slug))}" title="${escapeHtml(post.title)}">
    <span class="file-thumb">${icon("file")}</span><span class="file-post-name">
      <span>${escapeHtml(post.title)}</span><time datetime="${post.date}">${post.date}</time>
    </span></a>`;

  root.innerHTML = `<div class="file-app">
    <div class="file-toolbar">
      <button class="icon-button" data-history="-1" aria-label="后退" title="后退">${icon("chevron-left")}</button>
      <button class="icon-button" data-history="1" aria-label="前进" title="前进">${icon("chevron-right")}</button>
      <div class="file-path"></div>
      <button class="icon-button" data-view aria-label="列表视图" title="列表视图" aria-pressed="false">${icon("list")}</button>
    </div>
    <nav class="file-sidebar" aria-label="位置" data-scroll>${locations.map(({ id, name, icon: glyph }) =>
      `<button class="location" data-go="${id}" title="${name}" aria-label="${name}">${icon(glyph)}<span>${name}</span></button>`).join("")}</nav>
    <div class="file-view" tabindex="-1" data-scroll></div>
    <div class="file-status"></div>
  </div>`;

  const view = root.querySelector(".file-view");
  const path = root.querySelector(".file-path");
  const status = root.querySelector(".file-status");
  const back = root.querySelector('[data-history="-1"]');
  const forward = root.querySelector('[data-history="1"]');
  const viewToggle = root.querySelector("[data-view]");
  const sidebar = [...root.querySelectorAll(".location")];
  const history = ["home"];
  let cursor = 0;

  function render() {
    const current = history[cursor];
    const location = locations.find(({ id }) => id === current) ?? (current === "music-siren" ? { name: "塞壬唱片" } : null);
    const files = current === "pictures" ? [wallpaper] : current === "docs" ? [noteFile] : [];
    let count = files.length;

    path.innerHTML = `${icon("home")}<span>主文件夹</span>${
      current === "home" ? "" : `${current === "music-siren" ? `${icon("chevron-right")}<span>音乐</span>` : ""}${icon("chevron-right")}<span>${location?.name ?? wallpaper.name}</span>`
    }`;
    path.title = location?.name ?? wallpaper.name;
    for (const button of sidebar) {
      if (button.dataset.go === current) button.setAttribute("aria-current", "location");
      else button.removeAttribute("aria-current");
    }
    updateHistoryButtons();

    if (current === "home") {
      const latest = posts.slice(0, 4);
      count = locations.length - 1 + latest.length;
      view.innerHTML = `<h3 class="file-heading">文件夹</h3>
        <div class="folder-grid">${locations.slice(1).map(folderButton).join("")}</div>
        <h3 class="file-heading">最近文章</h3><div class="recent-grid">${latest.map(postLink).join("")}</div>`;
    } else if (current === "articles") {
      count = posts.length;
      view.innerHTML = `<div class="recent-grid">${posts.map(postLink).join("")}</div>`;
    } else if (current === "music") {
      const local = player.tracks.filter((track) => !track.folder);
      count = local.length + 1;
      view.innerHTML = `<div class="recent-grid">${folderButton({ id: "music-siren", name: "塞壬唱片", color: "#dbafd7" }, true)}${local.map(musicButton).join("")}</div>`;
      markTrack(player.current);
    } else if (current === "music-siren") {
      const songs = player.tracks.filter((track) => track.folder === "塞壬唱片");
      count = songs.length;
      view.innerHTML = `<div class="recent-grid">${songs.map(musicButton).join("")}</div>`;
      markTrack(player.current);
    } else if (current === "wallpaper") {
      count = 1;
      view.innerHTML = `<img class="image-preview" src="${wallpaperUrl}" alt="暮色海湾">`;
    } else {
      view.innerHTML = `<div class="recent-grid">${files.map(fileButton).join("")}</div>`;
    }
    status.textContent = `${count} 项`;
    view.scrollTop = 0;
  }

  function markTrack(current) {
    for (const button of view.querySelectorAll("[data-track]")) {
      if (button.dataset.track === current?.id) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    }
  }
  player.subscribe(markTrack);

  function updateHistoryButtons() {
    back.disabled = cursor === 0;
    forward.disabled = cursor === history.length - 1;
  }

  function setList(list) {
    view.classList.toggle("is-list", list);
    viewToggle.innerHTML = icon(list ? "grid" : "list");
    viewToggle.setAttribute("aria-pressed", String(list));
  }

  function go(id) {
    if (history[cursor] === id) return;
    history.splice(cursor + 1, Infinity, id);
    cursor += 1;
    render();
  }

  root.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button === viewToggle) {
      setList(!view.classList.contains("is-list"));
    } else if (button.dataset.history) {
      cursor += Number(button.dataset.history);
      render();
    } else if (button.dataset.file === "notes") {
      openApp("notes");
    } else if (button.dataset.track) {
      player.select(button.dataset.track);
    } else if (button.dataset.go || button.dataset.file) {
      const fromView = view.contains(button);
      go(button.dataset.go ?? button.dataset.file);
      if (fromView && event.detail === 0) view.focus({ preventScroll: true });
    }
  });
  render();
  return {
    capture: () => ({ history: [...history], cursor, list: view.classList.contains("is-list") }),
    restore(state) {
      const changed = history[cursor] !== state.history[state.cursor];
      history.splice(0, history.length, ...state.history);
      cursor = state.cursor;
      setList(state.list);
      if (changed) render();
      else updateHistoryButtons();
    },
  };
}

function mountNotes(root) {
  root.innerHTML = '<textarea class="note-editor" aria-label="便笺" spellcheck="false"></textarea>';
  const editor = root.firstElementChild;
  editor.value = readSetting("notes", "待办\n\n□ 整理下载\n□ 归档截图");
  editor.addEventListener("input", () => writeSetting("notes", editor.value));
}

function mountCalendar(root) {
  root.innerHTML = `<div class="calendar">
    <div class="month-bar">
      <h3></h3>
      <div>
        <button class="icon-button" data-month="-1" aria-label="上个月" title="上个月">${icon("chevron-left")}</button>
        <button class="icon-button" data-month="1" aria-label="下个月" title="下个月">${icon("chevron-right")}</button>
      </div>
    </div>
    <div class="month-grid"></div>
  </div>`;
  const heading = root.querySelector("h3");
  const grid = root.querySelector(".month-grid");
  const now = new Date();
  let month = new Date(now.getFullYear(), now.getMonth(), 1);

  function render() {
    const today = new Date();
    const year = month.getFullYear();
    const index = month.getMonth();
    const offset = (month.getDay() + 6) % 7;
    heading.textContent = `${year}年${index + 1}月`;
    const weekdays = [..."一二三四五六日"].map((day) => `<span class="weekday">${day}</span>`);
    const days = Array.from({ length: 42 }, (_, i) => {
      const day = new Date(year, index, i + 1 - offset);
      const current = day.toDateString() === today.toDateString();
      const classes = day.getMonth() !== index ? "day outside" : current ? "day today" : "day";
      return `<span class="${classes}"${current ? ' aria-current="date"' : ""}>${day.getDate()}</span>`;
    });
    grid.innerHTML = [...weekdays, ...days].join("");
  }
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-month]");
    if (!button) return;
    month = new Date(month.getFullYear(), month.getMonth() + Number(button.dataset.month), 1);
    render();
  });
  render();
}

export const apps = [
  { id: "files", title: "文件", icon: "folder", color: "#d1b9ff", mount: mountFiles },
  {
    id: "terminal", title: "终端", icon: "terminal", color: "#a5decb",
    mount: (root, { openArticle, windowId }) => mountTerminal(root, {
      directories: locations.slice(1).map(({ name }) => name),
      baseUrl: siteBase, posts, postHref, openArticle, windowId,
    }),
  },
  { id: "archive", title: "归档", icon: "folder", color: "#d1b9ff", mount: mountArchive },
  { id: "reader", title: "阅读器", icon: "file", color: "#cfc3fa", mount: mountReader },
  { id: "profile", title: "关于我", icon: "home", color: "#a5decb", mount: mountProfile },
  { id: "projects", title: "项目", icon: "display", color: "#aebeff", mount: mountProjects },
  { id: "notes", title: "便笺", icon: "note", color: "#f3cf99", mount: mountNotes },
  { id: "calendar", title: "日历", icon: "calendar", color: "#aebeff", mount: mountCalendar },
];
