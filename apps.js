import { mountArchive, mountProfile, mountProjects, mountReader } from "./blog/apps.js";
import { postHref, posts, siteBase } from "./blog/content.js";
import { escapeHtml } from "./blog/markup.js";
import { icon } from "./icons.js";
import { mountTerminal } from "./terminal/view.js";

export function paintRange(input) {
  const progress = 100 * (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
  input.style.setProperty("--progress", `${progress}%`);
}

export function readSetting(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(`niri-desktop:${key}`)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeSetting(key, value) {
  try {
    localStorage.setItem(`niri-desktop:${key}`, JSON.stringify(value));
  } catch {
    // The desktop still works when browser storage is disabled.
  }
}

const locations = [
  { id: "home", name: "主文件夹", icon: "home" },
  { id: "articles", name: "文章", icon: "file", color: "#c8aff7" },
  { id: "docs", name: "文档", icon: "file", color: "#c8aff7" },
  { id: "pictures", name: "图片", icon: "image", color: "#e2b3d7" },
];

const wallpaper = { name: "暮色海湾.webp", id: "wallpaper" };
const noteFile = { name: "便笺.txt", id: "notes" };
const wallpaperUrl = new URL("./assets/dusk.webp", import.meta.url).href;

function mountFiles(root, openApp) {
  const folderButton = ({ id, name, color }) =>
    `<button class="file-item" type="button" data-go="${id}" style="--folder-color:${color}">${icon("folder-fill")}<span>${name}</span></button>`;
  const fileButton = ({ id, name }) => `<button class="file-item recent-item" type="button" data-file="${id}" title="${name}">
    ${id === "wallpaper" ? `<img class="file-thumb" src="${wallpaperUrl}" alt="">` : `<span class="file-thumb">${icon("file")}</span>`}
    <span>${name}</span></button>`;
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
    const location = locations.find(({ id }) => id === current);
    const files = current === "pictures" ? [wallpaper] : current === "docs" ? [noteFile] : [];
    let count = files.length;

    path.innerHTML = `${icon("home")}<span>主文件夹</span>${
      current === "home" ? "" : `${icon("chevron-right")}<span>${location?.name ?? wallpaper.name}</span>`
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
    } else if (current === "wallpaper") {
      count = 1;
      view.innerHTML = `<img class="image-preview" src="${wallpaperUrl}" alt="暮色海湾">`;
    } else {
      view.innerHTML = `<div class="recent-grid">${files.map(fileButton).join("")}</div>`;
    }
    status.textContent = `${count} 项`;
    view.scrollTop = 0;
  }

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
      openApp("notes", { keyboard: event.detail === 0 });
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

const tracks = [
  { title: "晚潮", artist: "海湾", source: new URL("./assets/low-tide.mp3", import.meta.url).href },
  { title: "月落", artist: "海湾", source: new URL("./assets/moonset.mp3", import.meta.url).href },
];

function mountMusic(root) {
  root.innerHTML = `<div class="player">
    <div class="track-row">
      <div class="cover" aria-hidden="true"></div>
      <div class="track-meta">
        <h3 class="track-title"></h3><p class="track-artist"></p>
        <div class="player-controls">
          <button class="icon-button" data-prev aria-label="上一首" title="上一首">${icon("prev")}</button>
          <button class="play-button" data-play aria-label="播放" title="播放">${icon("play")}</button>
          <button class="icon-button" data-next aria-label="下一首" title="下一首">${icon("next")}</button>
        </div>
      </div>
    </div>
    <div class="progress-row">
      <span class="track-current">0:00</span>
      <input type="range" min="0" max="100" value="0" step="0.1" aria-label="播放进度">
      <span class="track-duration">0:00</span>
    </div>
    <audio id="player-audio" preload="metadata"></audio>
  </div>`;

  const audio = root.querySelector("audio");
  const play = root.querySelector("[data-play]");
  const cover = root.querySelector(".cover");
  const title = root.querySelector(".track-title");
  const artist = root.querySelector(".track-artist");
  const current = root.querySelector(".track-current");
  const duration = root.querySelector(".track-duration");
  const range = root.querySelector("input");
  let trackIndex = 0;

  const format = (seconds) => {
    const time = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
    return `${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}`;
  };
  const update = () => {
    current.textContent = format(audio.currentTime);
    duration.textContent = format(audio.duration);
    range.value = audio.duration > 0 ? 100 * audio.currentTime / audio.duration : 0;
    paintRange(range);
  };
  const updatePlay = () => {
    const playing = !audio.paused && !audio.ended;
    const label = playing ? "暂停" : "播放";
    play.innerHTML = icon(playing ? "pause" : "play");
    play.setAttribute("aria-label", label);
    play.title = label;
  };
  function selectTrack(index, resume) {
    trackIndex = (index + tracks.length) % tracks.length;
    const track = tracks[trackIndex];
    cover.dataset.track = trackIndex;
    title.textContent = track.title;
    artist.textContent = track.artist;
    audio.src = track.source;
    update();
    if (resume) audio.play().catch(updatePlay);
  }
  play.addEventListener("click", () => {
    if (audio.paused) audio.play().catch(updatePlay);
    else audio.pause();
  });
  root.querySelector("[data-prev]").addEventListener("click", () => selectTrack(trackIndex - 1, !audio.paused));
  root.querySelector("[data-next]").addEventListener("click", () => selectTrack(trackIndex + 1, !audio.paused));
  range.addEventListener("input", () => {
    if (audio.duration > 0) audio.currentTime = audio.duration * Number(range.value) / 100;
    paintRange(range);
  });
  for (const event of ["loadedmetadata", "timeupdate", "emptied"]) audio.addEventListener(event, update);
  for (const event of ["play", "pause", "ended"]) audio.addEventListener(event, updatePlay);
  selectTrack(0, false);
  return { close: () => audio.pause() };
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
  { id: "files", title: "文件", icon: "folder", color: "#d1b9ff", mount: (root, { openApp }) => mountFiles(root, openApp) },
  {
    id: "terminal", title: "终端", icon: "terminal", color: "#a5decb",
    mount: (root, { openArticle }) => mountTerminal(root, {
      directories: locations.slice(1).map(({ name }) => name),
      baseUrl: siteBase, posts, postHref, openArticle,
    }),
  },
  { id: "music", title: "音乐", icon: "music", color: "#f0b9d7", mount: mountMusic },
  { id: "archive", title: "归档", icon: "folder", color: "#d1b9ff", mount: mountArchive },
  { id: "reader", title: "阅读器", icon: "file", color: "#cfc3fa", mount: mountReader },
  { id: "profile", title: "关于我", icon: "home", color: "#a5decb", mount: mountProfile },
  { id: "projects", title: "项目", icon: "display", color: "#aebeff", mount: mountProjects },
  { id: "notes", title: "便笺", icon: "note", color: "#f3cf99", mount: mountNotes },
  { id: "calendar", title: "日历", icon: "calendar", color: "#aebeff", mount: mountCalendar },
];
