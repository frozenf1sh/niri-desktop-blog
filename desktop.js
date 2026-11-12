import { apps, icon, paintRange, readSetting, writeSetting } from "./apps.js";
import { postBySlug, posts, siteBase } from "./blog/content.js";
import { pageTitle } from "./blog/markup.js";
import { connectNavigation } from "./blog/navigation.js";
import { readRoute, workspaces } from "./blog/routes.js";

const $ = (selector, root = document) => root.querySelector(selector);
const all = (selector, root = document) => [...root.querySelectorAll(selector)];
const root = document.documentElement;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const compactLayout = matchMedia("(max-width: 800px), (max-height: 560px)");
const activeLabel = $("#active-app");
const windows = new Map();
const initialRoute = readRoute(location.pathname, siteBase.pathname) ?? { workspace: "home" };
let workspaceIndex = workspaces.findIndex(({ id }) => id === initialRoute.workspace);
root.style.setProperty("--workspace-index", workspaceIndex);
const spaces = workspaces.map((config, index) => {
  const active = index === workspaceIndex;
  const button = document.createElement("button");
  button.className = "workspace-button";
  button.dataset.workspace = config.id;
  button.title = config.label;
  button.setAttribute("aria-label", config.label);
  button.setAttribute("aria-pressed", String(active));
  button.append(document.createElement("span"));

  const el = document.createElement("section");
  el.className = "workspace";
  el.id = `workspace-${config.id}`;
  el.dataset.workspace = config.id;
  el.setAttribute("aria-label", config.label);
  el.style.setProperty("--workspace-slot", index);
  el.inert = !active;
  const tiles = document.createElement("div");
  tiles.className = "tiles";
  el.append(tiles);
  $("#workspaces").append(button);
  $("#workspace-track").append(el);
  return { ...config, el, index, button, tiles, windows: [], active: null, maximized: null };
});

// Sample a critically damped spring and let the browser interpolate the transforms.
const settle = (t) => 1 - (1 + t) * Math.exp(-t);
const springCurve = `linear(${Array.from({ length: 29 }, (_, i) =>
  (settle(10.5 * i / 28) / settle(10.5)).toFixed(5)).join(",")})`;
const spring = CSS.supports("transition-timing-function", springCurve) ? springCurve : "cubic-bezier(.22, 1, .36, 1)";
root.style.setProperty("--spring", spring);

function updateActiveLabel() {
  const app = spaces[workspaceIndex].active?.app;
  activeLabel.hidden = !app;
  if (app) {
    $("use", activeLabel).setAttribute("href", `#i-${app.icon}`);
    $("span", activeLabel).textContent = app.title;
  }
}

function focusWindow(record) {
  if (record.el.hidden || record.closing || record.space.index !== workspaceIndex) return;
  record.space.active = record;
  for (const item of record.space.windows) item.el.classList.toggle("is-focused", item === record);
  updateActiveLabel();
}

function renderLayout(space) {
  const shown = space.windows.filter((record) => record.open && (!space.maximized || space.maximized === record));
  if (!shown.includes(space.active)) space.active = shown[0] ?? null;
  space.tiles.dataset.count = shown.length;
  space.tiles.style.setProperty("--rows", Math.max(1, shown.length - 1));
  space.tiles.toggleAttribute("data-maximized", Boolean(space.maximized));
  for (const record of space.windows) {
    const maximized = space.maximized === record;
    record.el.hidden = !shown.includes(record);
    record.el.classList.toggle("is-lead", record === shown[0]);
    record.el.classList.toggle("is-focused", record === space.active);
    $("use", record.maxButton).setAttribute("href", `#i-${maximized ? "restore" : "maximize"}`);
    record.maxButton.title = maximized ? "还原" : "最大化";
    record.maxButton.setAttribute("aria-label", record.maxButton.title);
  }
  if (space.index === workspaceIndex) updateActiveLabel();
}

function commitLayout(space, change) {
  const animate = !reduceMotion.matches && space.index === workspaceIndex;
  const before = new Map(animate ? space.windows.filter(({ el }) => !el.hidden)
    .map((record) => [record, record.el.getBoundingClientRect()]) : []);
  for (const record of space.windows) record.geometry?.cancel();
  change();
  renderLayout(space);
  if (!animate) return;

  const after = space.windows.filter(({ el }) => !el.hidden)
    .map((record) => [record, record.el.getBoundingClientRect()]);
  for (const [record, rect] of after) {
    const old = before.get(record);
    if (!old) {
      record.geometry = record.el.animate(
        [{ transform: "translateY(12px) scale(.965)", opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: 260, easing: spring },
      );
      continue;
    }
    const [x, y, w, h] = [old.left - rect.left, old.top - rect.top, old.width / rect.width, old.height / rect.height];
    if (Math.abs(x) < 1 && Math.abs(y) < 1 && Math.abs(w - 1) < .005 && Math.abs(h - 1) < .005) continue;
    record.geometry = record.el.animate(
      [{ transformOrigin: "0 0", transform: `translate(${x}px, ${y}px) scale(${w}, ${h})` },
        { transformOrigin: "0 0", transform: "none" }],
      { duration: 410, easing: spring },
    );
  }
}

function closeWindow(record) {
  if (record.closing || !record.open) return;
  const { el, space } = record;
  const hadFocus = el.contains(document.activeElement);
  const finish = () => {
    record.closing = null;
    const recoverFocus = hadFocus && (el.contains(document.activeElement) || document.activeElement === document.body);
    record.api.close?.();
    commitLayout(space, () => {
      record.open = false;
      el.inert = false;
      if (space.maximized === record) space.maximized = null;
    });
    if (recoverFocus && workspaceIndex === space.index) {
      (space.active?.el ?? $("#launch-button")).focus({ preventScroll: true });
    }
  };
  if (reduceMotion.matches) {
    finish();
    return;
  }
  el.inert = true;
  record.closing = el.animate(
    [{ opacity: 1, scale: "1", translate: "0 0" }, { opacity: 0, scale: ".96", translate: "0 10px" }],
    { duration: 175, easing: "cubic-bezier(.3, .15, .4, 1)", fill: "forwards" },
  );
  const closing = record.closing;
  closing.finished.then(() => {
    if (record.closing !== closing) return;
    finish();
    closing.cancel();
  }, () => {});
}

function toggleMaximize(record) {
  const { space } = record;
  if (!record.open || record.closing) return;
  commitLayout(space, () => {
    space.active = record;
    space.maximized = space.maximized === record ? null : record;
    if (space.maximized) space.el.scrollTop = 0;
  });
}

const panels = [
  { trigger: $("#launch-button"), element: $("#launcher") },
  { trigger: $("#status-button"), element: $("#control-center") },
];
let openPanel = null;

function setPanel(panel, keyboard = false) {
  const previous = openPanel;
  openPanel = panel;
  for (const item of panels) {
    const open = item === panel;
    item.element.classList.toggle("is-open", open);
    item.element.inert = !open;
    item.trigger.setAttribute("aria-expanded", String(open));
  }
  if (keyboard) {
    (panel ? $("button", panel.element) : previous?.trigger)?.focus({ preventScroll: true });
  }
}

for (const panel of panels) {
  panel.trigger.addEventListener("click", (event) => setPanel(openPanel === panel ? null : panel, event.detail === 0));
}
document.addEventListener("pointerdown", (event) => {
  if (openPanel && !openPanel.element.contains(event.target) && !openPanel.trigger.contains(event.target)) setPanel(null);
});

function switchWorkspace(index) {
  if (!spaces[index]) return;
  setPanel(null);
  if (workspaceIndex === index) return;
  const focusWasInWorkspace = spaces[workspaceIndex].el.contains(document.activeElement);
  workspaceIndex = index;
  root.style.setProperty("--workspace-index", index);
  for (const space of spaces) {
    const active = space.index === index;
    space.el.inert = !active;
    space.button.setAttribute("aria-pressed", String(active));
  }
  if (focusWasInWorkspace) spaces[index].button.focus({ preventScroll: true });
  updateActiveLabel();
}

function cancelClose(record) {
  if (!record.closing) return;
  record.closing.cancel();
  record.closing = null;
  record.el.inert = false;
}

function showWindow(record) {
  const { space } = record;
  cancelClose(record);
  if (!record.open || (space.maximized && space.maximized !== record)) {
    commitLayout(space, () => {
      record.open = true;
      space.maximized = null;
      space.active = record;
    });
  }
  focusWindow(record);
}

function revealWindow(record, instant = false) {
  const { space, el } = record;
  if (compactLayout.matches) {
    const top = el.offsetTop;
    if (top < space.el.scrollTop || top + el.offsetHeight > space.el.scrollTop + space.el.clientHeight) {
      space.el.scrollTo({ top: Math.max(0, top - 4), behavior: instant || reduceMotion.matches ? "instant" : "smooth" });
    }
  }
}

function openApp(id, { keyboard = false } = {}) {
  const record = windows.get(id);
  if (!record) return;
  goToWorkspace(record.space.index);
  showWindow(record);
  revealWindow(record);
  const { el } = record;
  if (keyboard) el.focus({ preventScroll: true });
}

function mountWindow(app, space, open) {
  const el = document.createElement("article");
  el.className = "window";
  el.dataset.app = app.id;
  el.style.setProperty("--app-color", app.color);
  el.tabIndex = -1;
  el.setAttribute("aria-labelledby", `title-${app.id}`);
  el.innerHTML = `<header class="window-bar">
    <div class="window-title">${icon(app.icon)}<h2 id="title-${app.id}">${app.title}</h2></div>
    <div class="window-actions">
      <button class="icon-button" data-max aria-label="最大化" title="最大化">${icon("maximize")}</button>
      <button class="icon-button window-close" aria-label="关闭" title="关闭">${icon("close")}</button>
    </div>
  </header><div class="window-body"></div>`;
  const maxButton = $("[data-max]", el);
  const record = { app, el, space, maxButton, open, closing: null, geometry: null };
  windows.set(app.id, record);
  space.windows.push(record);
  space.tiles.append(el);
  record.api = app.mount($(".window-body", el), { openApp }) ?? {};
  el.addEventListener("pointerdown", () => focusWindow(record));
  el.addEventListener("focusin", () => focusWindow(record));
  maxButton.addEventListener("click", () => toggleMaximize(record));
  $(".window-close", el).addEventListener("click", () => closeWindow(record));
  $(".window-bar", el).addEventListener("dblclick", (event) => {
    if (!event.target.closest("button")) toggleMaximize(record);
  });
}

const appById = new Map(apps.map((app) => [app.id, app]));
for (const space of spaces) {
  for (const id of space.apps) mountWindow(appById.get(id), space, true);
  for (const id of space.utilities ?? []) mountWindow(appById.get(id), space, false);
  renderLayout(space);
}

function captureView(origin = document.activeElement) {
  const space = spaces[workspaceIndex];
  return {
    space,
    active: space.active,
    maximized: space.maximized?.closing ? null : space.maximized,
    windows: space.windows.map((record) => ({
      record, open: record.open && !record.closing, state: record.api.capture?.(),
    })),
    scroll: [space.el, ...all(".window-body, [data-scroll]", space.el)].map((el) => [el, el.scrollTop]),
    focus: origin,
    focusHref: origin?.closest?.("a[data-blog-link]")?.href,
  };
}

function restoreLayout(snapshot) {
  const { space } = snapshot;
  for (const { record, open, state } of snapshot.windows) {
    cancelClose(record);
    record.geometry?.cancel();
    if (record.open && !open) record.api.close?.();
    record.open = open;
    record.api.restore?.(state);
  }
  space.active = snapshot.active;
  space.maximized = snapshot.maximized;
  renderLayout(space);
}

function restorePosition(snapshot) {
  let focus = snapshot.focus;
  if (!focus?.isConnected && snapshot.focusHref) {
    focus = all("a[data-blog-link]", snapshot.space.el).find((link) => link.href === snapshot.focusHref);
  }
  if (focus?.isConnected && !focus.closest("[hidden], [inert]")) focus.focus({ preventScroll: true });
  for (const [el, top] of snapshot.scroll) el.scrollTop = top;
}

let lastArticle;
function displayRoute(route, { snapshot, revealArticle = false, keyboard = false } = {}) {
  const space = spaces.find(({ id }) => id === route.workspace);
  switchWorkspace(space.index);
  if (snapshot) restoreLayout(snapshot);

  let post;
  if (route.workspace === "articles") {
    lastArticle = route.slug;
    post = route.slug ? postBySlug.get(route.slug) : posts[0];
    const reader = windows.get("reader");
    if (revealArticle) showWindow(reader);
    reader.api.show(post, route.slug);
    windows.get("archive").api.select(post?.slug);
    if (revealArticle) {
      revealWindow(reader, true);
      if (keyboard) reader.api.focus();
    }
  }
  document.title = pageTitle(route, post);
  if (snapshot) restorePosition(snapshot);
}

const navigate = connectNavigation({ base: siteBase, capture: captureView, display: displayRoute });
function goToWorkspace(index) {
  const space = spaces[index];
  if (!space) return;
  if (index === workspaceIndex) {
    setPanel(null);
    return;
  }
  navigate({ workspace: space.id, slug: space.id === "articles" ? lastArticle : undefined });
}
displayRoute(initialRoute, { revealArticle: Boolean(initialRoute.slug) });
$("#static-page")?.remove();
document.body.classList.remove("has-static-page");

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-blog-link]");
  if (!link || event.defaultPrevented || event.button !== 0
      || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
  const url = new URL(link.href);
  if (url.origin !== siteBase.origin) return;
  const route = readRoute(url.pathname, siteBase.pathname);
  if (!route) return;
  event.preventDefault();
  navigate(route, { origin: link, revealArticle: Boolean(route.slug), keyboard: event.detail === 0 });
});

$("#launcher").innerHTML = apps.map((app) => `<button class="launch-app" data-open="${app.id}" style="--app-color:${app.color}">
  <span class="launch-icon">${icon(app.icon)}</span><span>${app.title}</span></button>`).join("");
$("#launcher").addEventListener("click", (event) => {
  const app = event.target.closest("[data-open]");
  if (app) openApp(app.dataset.open, { keyboard: event.detail === 0 });
});
for (const space of spaces) space.button.addEventListener("click", () => goToWorkspace(space.index));

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || event.isComposing) return;
  if (event.key === "Escape") {
    if (openPanel) setPanel(null, true);
    else if (spaces[workspaceIndex].maximized) toggleMaximize(spaces[workspaceIndex].maximized);
    else return;
    event.preventDefault();
  } else if (event.altKey && !event.ctrlKey && !event.metaKey) {
    const number = /^Digit([1-9])$/.exec(event.code);
    if (number && spaces[Number(number[1]) - 1]) goToWorkspace(Number(number[1]) - 1);
    else if (event.code === "ArrowUp") goToWorkspace(workspaceIndex - 1);
    else if (event.code === "ArrowDown") goToWorkspace(workspaceIndex + 1);
    else return;
    event.preventDefault();
  }
});

let wheelAt = 0;
let wheelDistance = 0;
let wheelSwitched = false;
$(".desktop").addEventListener("wheel", (event) => {
  if (compactLayout.matches || openPanel || event.ctrlKey || event.target.closest(".window")) return;
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  const now = performance.now();
  if (now - wheelAt > 160) {
    wheelDistance = 0;
    wheelSwitched = false;
  }
  wheelAt = now;
  if (wheelSwitched) return;
  wheelDistance += event.deltaY * (event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? innerHeight : 1);
  if (Math.abs(wheelDistance) > 72) {
    goToWorkspace(workspaceIndex + Math.sign(wheelDistance));
    wheelSwitched = true;
  }
}, { passive: true });

const clockTime = $("#clock-time");
const clockDate = $("#clock-date");
const clockButton = $("#clock-button");
const timeFormatter = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function updateClock() {
  const now = new Date();
  clockTime.textContent = timeFormatter.format(now);
  clockTime.dateTime = clockTime.textContent;
  clockDate.textContent = `${now.getMonth() + 1}月${now.getDate()}日 周${"日一二三四五六"[now.getDay()]}`;
  clockButton.setAttribute("aria-label", `${clockTime.textContent}，${clockDate.textContent}，打开日历`);
  setTimeout(updateClock, 60000 - now.getTime() % 60000);
}
updateClock();
clockButton.addEventListener("click", (event) => openApp("calendar", { keyboard: event.detail === 0 }));

const settings = { wifi: true, bluetooth: false, dnd: false, night: false, muted: false, volume: 65, brightness: 100,
  ...readSetting("controls", {}) };
const quickToggles = all(".quick-tile");
const audio = $("#player-audio");
const volume = $("#volume");
const brightness = $("#brightness");
const mute = $("#mute-button");
const mutedIcon = $("#status-volume use");
const muteGlyph = $("use", mute);

function updateControls() {
  for (const button of quickToggles) button.setAttribute("aria-pressed", String(Boolean(settings[button.dataset.toggle])));
  $("#status-wifi use").setAttribute("href", settings.wifi ? "#i-wifi" : "#i-wifi-off");
  $("#status-dnd").hidden = !settings.dnd;
  document.body.classList.toggle("night", settings.night);
  volume.value = settings.volume;
  brightness.value = settings.brightness;
  const isSilent = settings.muted || Number(volume.value) === 0;
  const glyph = isSilent ? "#i-muted" : "#i-volume";
  mute.setAttribute("aria-pressed", String(Boolean(settings.muted)));
  mute.title = settings.muted ? "取消静音" : "静音";
  mutedIcon.setAttribute("href", glyph);
  muteGlyph.setAttribute("href", glyph);
  $("#volume-value").value = `${isSilent ? 0 : volume.value}%`;
  $("#brightness-value").value = `${brightness.value}%`;
  paintRange(volume);
  paintRange(brightness);
  audio.muted = Boolean(settings.muted);
  audio.volume = Number(volume.value) / 100;
  root.style.setProperty("--dimming", (100 - Number(brightness.value)) * .0065);
}

function setControl(key, value) {
  settings[key] = value;
  writeSetting("controls", settings);
  updateControls();
}

for (const button of quickToggles) {
  button.addEventListener("click", () => setControl(button.dataset.toggle, !settings[button.dataset.toggle]));
}
mute.addEventListener("click", () => setControl("muted", !settings.muted));
volume.addEventListener("input", () => {
  settings.muted = false;
  setControl("volume", Number(volume.value));
});
brightness.addEventListener("input", () => setControl("brightness", Number(brightness.value)));
updateControls();
