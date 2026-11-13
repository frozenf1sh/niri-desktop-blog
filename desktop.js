import { apps } from "./apps.js";
import { postBySlug, posts, siteBase } from "./blog/content.js";
import { pageTitle } from "./blog/markup.js";
import { connectNavigation } from "./blog/navigation.js";
import { readRoute, workspaces } from "./blog/routes.js";
import { icon } from "./icons.js";
import { mountPlayer } from "./music/player.js";
import { paintRange, readSetting, writeSetting } from "./settings.js";
import { bindWindowGestures } from "./window-gestures.js";
import { columnOf, copyColumns, distributeHeight, moveTile, removeTile } from "./window-layout.js";
import { animateWindowLayout, finishWindowLayout } from "./window-motion.js";
import { createWorkspaceViewport } from "./workspace-scroll.js";

const $ = (selector, root = document) => root.querySelector(selector);
const all = (selector, root = document) => [...root.querySelectorAll(selector)];
const root = document.documentElement;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const compactLayout = matchMedia("(max-width: 800px), (max-height: 560px)");
const hasWindowTransitions = typeof document.startViewTransition === "function";
const activeLabel = $("#active-app");
const desktop = $(".desktop");
const track = $("#workspace-track");
const wallpaper = $(".wallpaper");
track.style.transition = "none";
wallpaper.style.transition = "none";
const audio = $("#player-audio");
const musicBar = $("#music-bar");
const musicPanel = $("#music-panel");
const player = mountPlayer(audio, musicBar, musicPanel);
const appById = new Map(apps.map((app) => [app.id, app]));
const openWindows = new Map();
const routedApps = new Set(["archive", "reader"]);
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
  const viewport = document.createElement("div");
  viewport.className = "workspace-viewport";
  const tiles = document.createElement("div");
  tiles.className = "tiles";
  const navigation = document.createElement("nav");
  navigation.className = "column-navigation";
  navigation.setAttribute("aria-label", "横向窗口");
  navigation.hidden = true;
  navigation.innerHTML = `<button type="button" class="icon-button" title="向左滚动" aria-label="向左滚动">${icon("chevron-left")}</button>
    <button type="button" class="icon-button" title="向右滚动" aria-label="向右滚动">${icon("chevron-right")}</button>`;
  const parked = document.createElement("div");
  parked.hidden = true;
  viewport.append(tiles);
  el.append(viewport, navigation, parked);
  $("#workspaces").append(button);
  track.append(el);
  const space = {
    ...config, el, index, button, viewport, tiles, parked, windows: new Map(), columns: [],
    active: null, maximized: null, tiledScroll: 0,
  };
  space.view = createWorkspaceViewport(viewport, tiles, navigation, reduceMotion, (target) => {
    focusWindow(space.windows.get(target.dataset.app));
  }, () => updateSizes(space));
  return space;
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
  if (!record || record.el.hidden || record.closing || record.space.index !== workspaceIndex) return;
  record.space.active = record;
  for (const item of record.space.windows.values()) item.el.classList.toggle("is-focused", item === record);
  updateActiveLabel();
}

const recordsInOrder = (space) => space.columns.flatMap(({ windows }) => windows);

function makeColumn(windows) {
  return { windows, width: null };
}

function updateSizes(space) {
  const rendered = space.renderedColumns;
  if (!rendered) return;
  const layoutHeight = space.tiles.clientHeight;
  const first = rendered[0]?.el;
  const columnGap = first ? Number.parseFloat(getComputedStyle(first).rowGap) : 0;
  for (const { column, el, windows } of rendered) {
    const width = column.width;
    el.style.setProperty("--column-size", width ? `${width * 100}%` : "");
    const total = layoutHeight - columnGap * (windows.length - 1);
    const heights = windows.length > 1
      ? distributeHeight(windows.map(({ height }) => height ?? 1), total, Math.max(0, Math.min(112, total / windows.length)))
      : null;
    for (const [index, record] of windows.entries()) {
      const height = record.height;
      record.el.style.setProperty("--window-size", heights ? `${heights[index]}px` : height == null ? "" : `${height * 100}%`);
    }
  }
  space.view.updateNavigation();
}

function renderLayout(space) {
  const shown = space.columns.map((column) => ({ column, windows: column.windows
    .filter((record) => record.open && (!space.maximized || space.maximized === record)) })).filter(({ windows }) => windows.length);
  const visible = new Set(shown.flatMap(({ windows }) => windows));
  if (!visible.has(space.active)) space.active = visible.values().next().value ?? null;
  space.tiles.dataset.count = shown.length;
  space.tiles.toggleAttribute("data-maximized", Boolean(space.maximized));
  const activeElement = document.activeElement;
  const oldColumns = [...space.tiles.children];
  const reusable = new Map(oldColumns.map((el) => [el.firstElementChild, el]));
  const rendered = shown.map(({ column, windows }) => {
    const el = reusable.get(windows[0].el) ?? document.createElement("div");
    el.className = "tile-column";
    if (windows.length === 1) el.dataset.singleApp = windows[0].app.id;
    else delete el.dataset.singleApp;
    for (const [index, record] of windows.entries()) {
      if (el.children[index] !== record.el) el.insertBefore(record.el, el.children[index] ?? null);
    }
    return { column, el, windows };
  });
  for (const [index, { el }] of rendered.entries()) {
    if (space.tiles.children[index] !== el) space.tiles.insertBefore(el, space.tiles.children[index] ?? null);
  }
  for (const record of space.windows.values()) {
    const maximized = space.maximized === record;
    record.el.hidden = !visible.has(record);
    if (record.el.hidden && record.el.parentElement !== space.parked) space.parked.append(record.el);
    record.el.classList.toggle("is-focused", record === space.active);
    $("use", record.maxButton).setAttribute("href", `#i-${maximized ? "restore" : "maximize"}`);
    record.maxButton.title = maximized ? "还原" : "最大化";
    record.maxButton.setAttribute("aria-label", record.maxButton.title);
  }
  const used = new Set(rendered.map(({ el }) => el));
  for (const el of oldColumns) if (!used.has(el)) el.remove();
  space.renderedColumns = rendered;
  updateSizes(space);
  if (activeElement !== document.activeElement && activeElement?.isConnected && space.el.contains(activeElement)
      && !activeElement.closest("[hidden], [inert]")) focusWithoutMovingViewport(space, activeElement);
  if (space.index === workspaceIndex) updateActiveLabel();
}

function canAnimateLayout(space) {
  return !reduceMotion.matches && space.index === workspaceIndex
    && Math.abs(space.el.getBoundingClientRect().top - desktop.getBoundingClientRect().top) < 1;
}

function commitLayout(space, change, { primary = space.active, after } = {}) {
  const records = [...space.windows.values()];
  const animate = canAnimateLayout(space);
  const usesSnapshots = animate && hasWindowTransitions;
  const apply = () => {
    for (const record of records) record.geometry?.cancel();
    change();
    renderLayout(space);
    after?.(usesSnapshots);
  };
  if (usesSnapshots) {
    animateWindowLayout(records, primary?.el, apply, () => canAnimateLayout(space));
    return;
  }

  const before = new Map(animate ? records.filter(({ el }) => !el.hidden)
    .map((record) => [record, record.el.getBoundingClientRect()]) : []);
  apply();
  if (!animate) return;

  const newRects = records.filter(({ el }) => !el.hidden)
    .map((record) => [record, record.el.getBoundingClientRect()]);
  for (const [record, rect] of newRects) {
    const old = before.get(record);
    if (!old) {
      record.geometry = record.el.animate(
        [{ transform: "translateY(7px) scale(.985)", opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: 300, easing: spring },
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
  const visible = recordsInOrder(space);
  const index = visible.indexOf(record);
  const neighbor = visible[index + 1] ?? visible[index - 1];
  const hadFocus = el.contains(document.activeElement);
  const finish = () => {
    record.closing = null;
    let restoreTiles = false;
    let recoverFocus = false;
    commitLayout(space, () => {
      if (!record.open) return;
      recoverFocus = hadFocus && (el.contains(document.activeElement) || document.activeElement === document.body);
      record.api.close?.();
      record.open = false;
      if (openWindows.get(record.app.id) === record) openWindows.delete(record.app.id);
      const remaining = removeTile(space.columns, record);
      if (remaining?.windows.length === 1) remaining.windows[0].height = null;
      el.inert = false;
      if (space.active === record) space.active = neighbor;
      restoreTiles = space.maximized === record;
      if (restoreTiles) space.maximized = null;
    }, {
      primary: record,
      after() {
        if (restoreTiles) space.view.move(space.tiledScroll);
        if (space.active) space.view.reveal(space.active.el);
        if (recoverFocus && workspaceIndex === space.index) {
          focusWithoutMovingViewport(space, space.active?.el ?? $("#launch-button"));
        }
      },
    });
  };
  if (hasWindowTransitions || !canAnimateLayout(space)) {
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
    if (!record.open || record.closing) return;
    if (!space.maximized) space.tiledScroll = space.view.position();
    space.active = record;
    space.maximized = space.maximized === record ? null : record;
  }, {
    primary: record,
    after: () => space.view.move(space.maximized ? 0 : space.tiledScroll),
  });
}

const panels = [
  { trigger: $("#launch-button"), element: $("#launcher") },
  { trigger: $("#music-button"), element: musicPanel },
  { trigger: $("#status-button"), element: $("#control-center") },
];
let openPanel = null;

function positionMusicPanel() {
  musicPanel.style.setProperty("--music-panel-inset", `${innerWidth - musicBar.getBoundingClientRect().right}px`);
}

function setPanel(panel, keyboard = false) {
  const previous = openPanel;
  openPanel = panel;
  if (panel?.element === musicPanel) positionMusicPanel();
  for (const item of panels) {
    const open = item === panel;
    item.element.classList.toggle("is-open", open);
    item.element.inert = !open;
    item.trigger.setAttribute("aria-expanded", String(open));
  }
  if (keyboard) {
    (panel ? $("button:not(:disabled)", panel.element) : previous?.trigger)?.focus({ preventScroll: true });
  }
}

for (const panel of panels) {
  panel.trigger.addEventListener("click", (event) => setPanel(openPanel === panel ? null : panel, event.detail === 0));
}
new ResizeObserver(() => {
  if (openPanel?.element === musicPanel) positionMusicPanel();
}).observe(musicBar.parentElement);
document.addEventListener("pointerdown", (event) => {
  if (!openPanel || openPanel.element.contains(event.target) || openPanel.trigger.contains(event.target)) return;
  if (openPanel.element === musicPanel && musicBar.contains(event.target)) return;
  setPanel(null);
});

function switchWorkspace(index) {
  if (!spaces[index]) return;
  setPanel(null);
  if (workspaceIndex === index) return;
  finishWindowLayout();
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

function showWindow(record, onShown) {
  const { space } = record;
  cancelClose(record);
  const shown = (animateScroll) => {
    if (space.index !== workspaceIndex) return;
    focusWindow(record);
    onShown?.(animateScroll);
  };
  if (!record.open || (space.maximized && space.maximized !== record)) {
    let restoreTiles = false;
    commitLayout(space, () => {
      if (!record.open) {
        record.height = null;
        space.columns.push(makeColumn([record]));
      }
      record.open = true;
      openWindows.set(record.app.id, record);
      restoreTiles = Boolean(space.maximized);
      space.maximized = null;
      space.active = record;
    }, {
      primary: record,
      after(usesSnapshots) {
        if (restoreTiles) space.view.move(space.tiledScroll);
        shown(!usesSnapshots);
      },
    });
  } else shown(true);
}

function openApp(id) {
  const app = appById.get(id);
  if (!app) return;
  finishWindowLayout();
  const existing = openWindows.get(id);
  const space = existing?.space ?? (routedApps.has(id)
    ? spaces.find(({ apps }) => apps.includes(id))
    : spaces[workspaceIndex]);
  const record = existing ?? space.windows.get(id) ?? mountWindow(app, space, false);
  if (space.index !== workspaceIndex) goToWorkspace(space.index);
  setPanel(null);
  showWindow(record, (smooth) => {
    space.view.reveal(record.el, smooth);
    focusWithoutMovingViewport(space, record.el);
  });
}

function openArticle(slug, { origin, keyboard = false } = {}) {
  navigate({ workspace: "articles", slug }, { origin, revealArticle: true, keyboard });
}

function rearrangeWindow(record, target, placement) {
  const { space } = record;
  if (!target?.open || target === record || space.maximized) return;
  commitLayout(space, () => {
    const columns = moveTile(space.columns, record, target, placement);
    if (columns === space.columns) return;
    const previousColumn = columnOf(space.columns, record);
    const nextColumn = columnOf(columns, record);
    if (placement === "swap") {
      [record.height, target.height] = [target.height, record.height];
    } else if (previousColumn !== columnOf(space.columns, target) || placement === "left" || placement === "right") {
      for (const item of [...previousColumn.windows, ...nextColumn.windows]) item.height = null;
    }
    space.columns = columns;
    space.active = record;
  }, { primary: record, after: () => space.view.reveal(record.el) });
}

function startResize(record, axis, size) {
  const { space } = record;
  const column = columnOf(space.columns, record);
  const base = axis === "width" ? space.tiles.clientWidth : space.tiles.clientHeight;
  if (!column || !base) return;
  if (axis === "width") {
    const original = column.width;
    const left = space.view.position();
    const min = Math.min(235, base * .55);
    return (delta) => {
      if (delta === 0 && column.width === original) return;
      column.width = delta === null ? original : Math.min(base, Math.max(min, size + delta)) / base;
      updateSizes(space);
      if (delta === null) space.view.move(left);
    };
  }
  const original = column.windows.map((item) => [item, item.height]);
  const sizes = column.windows.map((item) => [item, item.el.getBoundingClientRect().height]);
  const total = sizes.reduce((sum, [, height]) => sum + height, 0);
  const minimum = Math.min(112, (sizes.length === 1 ? base : total) / sizes.length);
  return (delta) => {
    if (delta === null) {
      for (const [item, height] of original) item.height = height;
    } else if (sizes.length === 1) {
      record.height = Math.min(base, Math.max(minimum, size + delta)) / base;
    } else {
      const remaining = sizes.filter(([item]) => item !== record);
      const otherHeight = remaining.reduce((sum, [, height]) => sum + height, 0);
      const desired = Math.min(size + otherHeight - minimum * remaining.length, Math.max(minimum, size + delta));
      const allocations = distributeHeight(remaining.map(([, height]) => Math.max(0, height - minimum)),
        otherHeight + size - desired, minimum);
      record.height = Math.max(0, desired - minimum) / base;
      for (const [index, [item]] of remaining.entries()) {
        item.height = Math.max(0, allocations[index] - minimum) / base;
      }
    }
    updateSizes(space);
  };
}

function resetSize(record, axis) {
  const { space } = record;
  const column = columnOf(space.columns, record);
  if (!column) return;
  commitLayout(space, () => {
    if (axis === "width") column.width = null;
    else for (const item of column.windows) item.height = null;
  }, { primary: record, after: () => space.view.reveal(record.el) });
}

function mountWindow(app, space, open) {
  const windowId = `window-${space.id}-${app.id}`;
  const el = document.createElement("article");
  el.className = "window";
  el.id = windowId;
  el.hidden = !open;
  el.dataset.app = app.id;
  el.style.setProperty("--app-color", app.color);
  el.tabIndex = -1;
  el.setAttribute("aria-labelledby", `${windowId}-title`);
  el.innerHTML = `<header class="window-bar">
    <div class="window-title">${icon(app.icon)}<h2 id="${windowId}-title">${app.title}</h2></div>
    <div class="window-actions">
      <button class="icon-button" data-max aria-label="最大化" title="最大化">${icon("maximize")}</button>
      <button class="icon-button window-close" aria-label="关闭" title="关闭">${icon("close")}</button>
    </div>
  </header><div class="window-body"></div>
  <div class="window-resize" data-resize="width" data-edge="left" aria-hidden="true" title="拖动调整列宽，双击恢复"></div>
  <div class="window-resize" data-resize="width" data-edge="right" aria-hidden="true" title="拖动调整列宽，双击恢复"></div>
  <div class="window-resize" data-resize="height" data-edge="top" aria-hidden="true" title="拖动调整高度，双击恢复"></div>
  <div class="window-resize" data-resize="height" data-edge="bottom" aria-hidden="true" title="拖动调整高度，双击恢复"></div>`;
  const maxButton = $("[data-max]", el);
  const record = { app, el, space, maxButton, open, closing: null, geometry: null, height: null };
  space.windows.set(app.id, record);
  if (open) {
    space.columns.push(makeColumn([record]));
    openWindows.set(app.id, record);
  }
  space.parked.append(el);
  record.api = app.mount($(".window-body", el), { openApp, openArticle, player, windowId, actions: $(".window-actions", el) }) ?? {};
  record.api.show?.(lastArticleView.post, lastArticleView.slug);
  record.api.select?.(lastArticleView.post?.slug);
  el.addEventListener("pointerdown", () => focusWindow(record));
  el.addEventListener("focusin", () => {
    focusWindow(record);
    if (space.index === workspaceIndex && !space.keepViewport && document.activeElement?.matches(":focus-visible")) {
      space.view.reveal(el);
    }
  });
  bindWindowGestures(record, {
    canStart: () => record.open && !record.closing && !space.maximized && space.index === workspaceIndex,
    prepare: () => {
      finishWindowLayout();
      for (const item of space.windows.values()) item.geometry?.cancel();
      focusWindow(record);
    },
    drop: (id, placement) => rearrangeWindow(record, space.windows.get(id), placement),
    resize: (axis, size) => startResize(record, axis, size),
    reset: (axis) => resetSize(record, axis),
  });
  maxButton.addEventListener("click", () => toggleMaximize(record));
  $(".window-close", el).addEventListener("click", () => closeWindow(record));
  $(".window-bar", el).addEventListener("dblclick", (event) => {
    if (!event.target.closest("button")) toggleMaximize(record);
  });
  return record;
}

let lastArticleView = { post: posts[0], slug: undefined };
for (const space of spaces) {
  for (const id of space.apps) mountWindow(appById.get(id), space, true);
  renderLayout(space);
}

function captureView(origin = document.activeElement) {
  finishWindowLayout();
  const space = spaces[workspaceIndex];
  return {
    space,
    active: space.active,
    maximized: space.maximized?.closing ? null : space.maximized,
    tiledScroll: space.tiledScroll,
    horizontalScroll: space.view.position(),
    columns: copyColumns(space.columns),
    windows: recordsInOrder(space).map((record) => ({
      record, height: record.height, state: record.api.capture?.(),
    })),
    scroll: all(".window-body, [data-scroll]", space.el).map((el) => [el, el.scrollTop, el.scrollLeft]),
    focus: origin,
    focusHref: origin?.closest?.("a[data-blog-link]")?.href,
  };
}

function restoreLayout(snapshot) {
  const { space } = snapshot;
  const captured = new Set(snapshot.windows.map(({ record }) => record));
  for (const record of space.windows.values()) {
    if (captured.has(record)) continue;
    cancelClose(record);
    record.geometry?.cancel();
    if (record.open) record.api.close?.();
    record.open = false;
    if (openWindows.get(record.app.id) === record) openWindows.delete(record.app.id);
  }
  const available = new Set();
  for (const { record, height, state } of snapshot.windows) {
    cancelClose(record);
    record.geometry?.cancel();
    const existing = openWindows.get(record.app.id);
    if (existing && existing !== record) continue;
    record.open = true;
    openWindows.set(record.app.id, record);
    record.height = height;
    record.api.restore?.(state);
    available.add(record);
  }
  space.columns = copyColumns(snapshot.columns).map((column) => ({
    ...column, windows: column.windows.filter((record) => available.has(record)),
  })).filter(({ windows }) => windows.length);
  space.active = snapshot.active;
  space.maximized = available.has(snapshot.maximized) ? snapshot.maximized : null;
  space.tiledScroll = snapshot.tiledScroll;
  renderLayout(space);
}

function focusWithoutMovingViewport(space, el) {
  space.keepViewport = true;
  el.focus({ preventScroll: true });
  space.keepViewport = false;
}

function restorePosition(snapshot) {
  const { space } = snapshot;
  let focus = snapshot.focus;
  if (!focus?.isConnected && snapshot.focusHref) {
    focus = all("a[data-blog-link]", snapshot.space.el).find((link) => link.href === snapshot.focusHref);
  }
  if (focus?.isConnected && !focus.closest("[hidden], [inert]")) focusWithoutMovingViewport(space, focus);
  for (const [el, top, left] of snapshot.scroll) el.scrollTo({ top, left, behavior: "instant" });
  space.view.move(snapshot.horizontalScroll);
}

function displayRoute(route, { snapshot, revealArticle = false, keyboard = false } = {}) {
  const space = spaces.find(({ id }) => id === route.workspace);
  switchWorkspace(space.index);
  if (snapshot) restoreLayout(snapshot);

  let post;
  if (route.workspace === "articles") {
    post = route.slug ? postBySlug.get(route.slug) : posts[0];
    lastArticleView = { post, slug: route.slug };
    const reader = space.windows.get("reader");
    reader.api.show(post, route.slug);
    space.windows.get("archive").api.select(post?.slug);
    if (revealArticle) {
      showWindow(reader, () => {
        space.view.reveal(reader.el);
        if (keyboard) {
          const heading = $(".post h1", reader.el);
          if (heading) focusWithoutMovingViewport(space, heading);
        }
      });
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
  navigate({ workspace: space.id, slug: space.id === "articles" ? lastArticleView.slug : undefined });
}
displayRoute(initialRoute, { revealArticle: Boolean(initialRoute.slug) });
// Commit the initial position before enabling transitions for later navigation.
track.getBoundingClientRect();
wallpaper.getBoundingClientRect();
track.style.removeProperty("transition");
wallpaper.style.removeProperty("transition");
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
  if (app) openApp(app.dataset.open);
});
for (const space of spaces) space.button.addEventListener("click", () => goToWorkspace(space.index));

function focusColumn(direction) {
  const space = spaces[workspaceIndex];
  const columns = space.renderedColumns;
  const column = columns.findIndex(({ windows }) => windows.includes(space.active));
  const target = columns[column + direction]?.windows[0];
  if (!target) return;
  focusWindow(target);
  focusWithoutMovingViewport(space, target.el);
  space.view.reveal(target.el, true);
}

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
    else if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      if (event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      focusColumn(event.code === "ArrowLeft" ? -1 : 1);
    }
    else return;
    event.preventDefault();
  }
});

let wheelAt = 0;
let wheelDistance = 0;
let wheelSwitched = false;
$(".desktop").addEventListener("wheel", (event) => {
  if (compactLayout.matches || openPanel || event.shiftKey || event.ctrlKey || event.target.closest(".window")) return;
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
clockButton.addEventListener("click", () => openApp("calendar"));

const settings = { wifi: true, bluetooth: false, dnd: false, night: false, muted: false, volume: 65, brightness: 100,
  ...readSetting("controls", {}) };
const quickToggles = all(".quick-tile");
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
