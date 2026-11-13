import { paintRange, readSetting, writeSetting } from "../settings.js";
import { icon } from "../icons.js";
import { tracks, resolveResource } from "./library.js";
import { lyricAt, parseLyrics } from "./lyrics.js";
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
  const defaultTracks = tracks.filter((track) => track.folder === "塞壬唱片");
  let playlist = createPlaylist(defaultTracks.length ? defaultTracks : tracks, readSetting("music-mode", "shuffle"));
  if (playlist.current && playlist.mode === "shuffle") {
    const pool = defaultTracks.length ? defaultTracks : tracks;
    playlist.select(pool[Math.floor(Math.random() * pool.length)].id);
  }
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
  const cover = panel.querySelector("#music-cover");
  const lyric = document.querySelector("#music-lyric");
  const lyricText = lyric.querySelector(".music-lyric-text");
  const list = panel.querySelector("#music-list");
  const listeners = new Set();
  const rows = new Map();
  let playRequest = 0;
  let titleAnimation;
  let lyricAnimation;
  let resolveRequest = 0;
  let loadedId = null;
  let lyrics = [];

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
  function animateLyric() {
    lyricAnimation?.cancel();
    lyricAnimation = null;
    if (lyric.hidden || reducedMotion.matches || !lyric.clientWidth) return;
    const distance = lyricText.offsetWidth - lyric.clientWidth;
    if (distance < 2) return;
    lyricAnimation = lyricText.animate([
      { transform: "translateX(0)", offset: 0 },
      { transform: "translateX(0)", offset: .15 },
      { transform: `translateX(-${distance}px)`, offset: .5 },
      { transform: `translateX(-${distance}px)`, offset: .65 },
      { transform: "translateX(0)", offset: 1 },
    ], { duration: Math.max(4000, distance * 75 + 2000), iterations: Infinity });
    if (audio.paused) lyricAnimation.pause();
  }
  new ResizeObserver(animateLyric).observe(lyric);
  reducedMotion.addEventListener("change", () => { animateTitle(); animateLyric(); });

  function setLyric(text) {
    if (lyricText.textContent === text) return;
    lyricText.textContent = text;
    lyric.hidden = !text;
    animateLyric();
  }
  function renderPlaylist() {
    rows.clear();
    list.replaceChildren();
    for (const track of playlist.tracks) {
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
    for (const button of skipButtons) button.disabled = playlist.tracks.length < 2;
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
    setLyric(lyricAt(lyrics, audio.currentTime));
    if (lyricAnimation) {
      if (audio.paused) lyricAnimation.pause();
      else lyricAnimation.play();
    }
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

  function play(silent = false) {
    if (!playlist.current) return;
    if (loadedId !== playlist.current.id) {
      load(playlist.current, true, silent);
      return;
    }
    const request = ++playRequest;
    error.hidden = true;
    audio.play().catch((failure) => {
      if (request !== playRequest || failure.name === "AbortError") return;
      if (!silent || failure.name !== "NotAllowedError") error.hidden = false;
      updatePlay();
    });
  }

  async function load(track, autoplay, silent = false) {
    if (!track) return;
    const request = ++resolveRequest;
    playRequest++;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    loadedId = null;
    lyrics = [];
    setLyric("");
    cover.hidden = true;
    cover.removeAttribute("src");
    error.hidden = true;
    updateTrack();
    try {
      const resolved = await resolveResource(track);
      if (request !== resolveRequest) return;
      if (!resolved.source) throw new Error("Missing audio source");
      lyrics = parseLyrics(resolved.lyrics);
      if (resolved.cover) {
        cover.src = resolved.cover;
        cover.hidden = false;
      }
      audio.src = resolved.source;
      loadedId = track.id;
      if (autoplay) play(silent);
    } catch {
      if (request === resolveRequest) error.hidden = false;
    }
  }

  function select(id) {
    const track = tracks.find((item) => item.id === id);
    if (!track) return;
    if (!playlist.select(id)) {
      playlist = createPlaylist(tracks.filter((item) => item.folder === track.folder), playlist.mode);
      playlist.select(id);
      renderPlaylist();
    }
    load(track, true);
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
  for (const event of ["play", "pause", "ended", "emptied"]) audio.addEventListener(event, () => { updatePlay(); updateProgress(); });
  audio.addEventListener("ended", () => advance(1, true));
  audio.addEventListener("error", () => {
    if (playlist.current) error.hidden = false;
    updatePlay();
  });
  renderPlaylist();
  updateMode();
  cover.addEventListener("error", () => { cover.hidden = true; });
  if (playlist.current) load(playlist.current, true, true);
  else updateTrack();

  return {
    select,
    tracks,
    get current() { return playlist.current; },
    subscribe(listener) { listeners.add(listener); },
  };
}
