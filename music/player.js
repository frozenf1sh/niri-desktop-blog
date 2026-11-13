import { paintRange, readSetting, writeSetting } from "../settings.js";
import { icon } from "../icons.js";
import { tracks } from "./library.js";
import { createPlaylist, playbackModes } from "./playlist.js";
import "./player.css";

const labelFor = {
  sequence: "顺序播放",
  "repeat-one": "单曲循环",
  shuffle: "随机播放",
};
const iconFor = { sequence: "sequence", "repeat-one": "repeat-one", shuffle: "shuffle" };

function formatTime(seconds) {
  const time = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
  return `${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}`;
}

export function mountPlayer(audio, bar, panel) {
  const playlist = createPlaylist(tracks, readSetting("music-mode", "sequence"));
  const menuButton = bar.querySelector("#music-button");
  const titleViewport = bar.querySelector(".music-title-viewport");
  const barTitle = bar.querySelector(".music-bar-title");
  const title = panel.querySelector("#music-title");
  const playButtons = [...bar.querySelectorAll("[data-music-play]"), ...panel.querySelectorAll("[data-music-play]")];
  const skipButtons = [...bar.querySelectorAll("[data-music-step]"), ...panel.querySelectorAll("[data-music-step]")];
  const range = panel.querySelector("#music-progress");
  const elapsed = panel.querySelector("#music-elapsed");
  const duration = panel.querySelector("#music-duration");
  const mode = panel.querySelector("#music-mode");
  const error = panel.querySelector("#music-error");
  const list = panel.querySelector("#music-list");
  const listeners = new Set();
  const rows = new Map();
  let playRequest = 0;
  let titleAnimation;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  function animateTitle() {
    titleAnimation?.cancel();
    const distance = barTitle.offsetWidth - titleViewport.clientWidth;
    if (distance < 2 || reducedMotion.matches || !titleViewport.clientWidth) return;
    const duration = Math.max(4000, distance * 75 + 2000);
    titleAnimation = barTitle.animate([
      { transform: "translateX(0)", offset: 0 },
      { transform: "translateX(0)", offset: .15 },
      { transform: `translateX(-${distance}px)`, offset: .5 },
      { transform: `translateX(-${distance}px)`, offset: .65 },
      { transform: "translateX(0)", offset: 1 },
    ], { duration, iterations: Infinity });
  }
  new ResizeObserver(animateTitle).observe(titleViewport);
  reducedMotion.addEventListener("change", animateTitle);
  for (const track of tracks) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "music-list-track";
    button.innerHTML = icon("music");
    const name = document.createElement("span");
    name.textContent = track.title;
    button.title = track.fileName;
    button.append(name);
    button.addEventListener("click", () => select(track.id));
    item.append(button);
    list.append(item);
    rows.set(track.id, button);
  }

  function updatePlay() {
    const playing = !audio.paused && !audio.ended;
    const label = playing ? "暂停音乐" : "播放音乐";
    for (const button of playButtons) {
      button.querySelector("use").setAttribute("href", playing ? "#i-pause" : "#i-play");
      button.setAttribute("aria-label", label);
      button.title = label;
    }
  }

  function updateProgress() {
    const seekable = Number.isFinite(audio.duration) && audio.duration > 0;
    elapsed.textContent = formatTime(audio.currentTime);
    duration.textContent = formatTime(audio.duration);
    range.disabled = !seekable;
    range.value = seekable ? 100 * audio.currentTime / audio.duration : 0;
    paintRange(range);
  }

  function updateTrack() {
    const track = playlist.current;
    const name = track?.title ?? "暂无音乐";
    title.textContent = name;
    barTitle.textContent = name;
    menuButton.setAttribute("aria-label", `音乐：${name}`);
    menuButton.title = name;
    animateTitle();
    for (const [id, button] of rows) {
      if (id === track?.id) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    }
    for (const listener of listeners) listener(track);
    updateProgress();
    updatePlay();
  }

  function play() {
    if (!playlist.current) return;
    const request = ++playRequest;
    error.hidden = true;
    audio.play().catch((failure) => {
      if (request !== playRequest || failure.name === "AbortError") return;
      error.hidden = false;
      updatePlay();
    });
  }

  function load(track, autoplay) {
    if (!track) return;
    playRequest++;
    error.hidden = true;
    if (audio.src !== new URL(track.source, document.baseURI).href) {
      audio.src = track.source;
    } else {
      audio.currentTime = 0;
    }
    updateTrack();
    if (autoplay) play();
  }

  function select(id) {
    load(playlist.select(id), true);
  }

  function advance(direction, ended = false) {
    const autoplay = ended || !audio.paused;
    const track = playlist.advance(direction, ended);
    if (track) load(track, autoplay);
    else updatePlay();
  }

  function updateMode() {
    const label = labelFor[playlist.mode];
    mode.dataset.mode = playlist.mode;
    mode.setAttribute("aria-label", `播放模式：${label}`);
    mode.title = label;
    mode.querySelector("use").setAttribute("href", `#i-${iconFor[playlist.mode]}`);
    audio.loop = playlist.mode === "repeat-one";
  }

  for (const button of playButtons) {
    button.disabled = !tracks.length;
    button.addEventListener("click", () => {
      if (audio.paused || audio.ended) play();
      else {
        playRequest++;
        audio.pause();
      }
    });
  }
  for (const button of skipButtons) {
    button.disabled = tracks.length < 2;
    button.addEventListener("click", () => advance(Number(button.dataset.musicStep)));
  }
  mode.disabled = !tracks.length;
  mode.addEventListener("click", () => {
    const next = (playbackModes.indexOf(playlist.mode) + 1) % playbackModes.length;
    playlist.setMode(playbackModes[next]);
    updateMode();
    writeSetting("music-mode", playlist.mode);
  });
  range.addEventListener("input", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = audio.duration * Number(range.value) / 100;
    updateProgress();
  });
  for (const event of ["loadedmetadata", "durationchange", "timeupdate", "emptied"]) {
    audio.addEventListener(event, updateProgress);
  }
  menuButton.addEventListener("click", () => {
    audio.preload = "metadata";
  }, { once: true });
  for (const event of ["play", "pause", "ended", "emptied"]) audio.addEventListener(event, updatePlay);
  audio.addEventListener("ended", () => advance(1, true));
  audio.addEventListener("error", () => {
    if (playlist.current) error.hidden = false;
    updatePlay();
  });
  updateMode();
  if (playlist.current) load(playlist.current, false);
  else updateTrack();

  return {
    select,
    tracks,
    get current() { return playlist.current; },
    subscribe(listener) { listeners.add(listener); },
  };
}
