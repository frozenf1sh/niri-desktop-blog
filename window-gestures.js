const editable = "button, a, input, textarea, select, [contenteditable]";
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function trackPointer(event, handle, move, end) {
  const id = event.pointerId;
  const root = handle.ownerDocument;
  const listeners = new AbortController();
  const options = { capture: true, signal: listeners.signal };

  function finish(cancelled = false) {
    listeners.abort();
    if (handle.hasPointerCapture(id)) handle.releasePointerCapture(id);
    end({ cancelled });
  }
  function onMove(event) {
    if (event.pointerId !== id) return;
    // A move may report the release before a separate pointerup arrives.
    if (event.buttons & 1) move(event);
    else finish();
  }
  function onEnd(event) {
    if (event.pointerId === id) finish();
  }
  function onCancel(event) {
    if (event.pointerId === id) finish(event.pointerType !== "mouse");
  }
  function onKey(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    finish(true);
  }
  handle.setPointerCapture(id);
  root.addEventListener("pointermove", onMove, options);
  root.addEventListener("pointerup", onEnd, options);
  root.addEventListener("pointercancel", onCancel, options);
  root.addEventListener("lostpointercapture", onEnd, options);
  root.addEventListener("keydown", onKey, options);
}

function dropZone(el, x, y) {
  const rect = el.getBoundingClientRect();
  const horizontal = (x - rect.left) / rect.width;
  const vertical = (y - rect.top) / rect.height;
  if (horizontal < .22) return "left";
  if (horizontal > .78) return "right";
  if (vertical < .28) return "top";
  if (vertical > .72) return "bottom";
  return "swap";
}

export function bindWindowGestures(record, { canStart, prepare, drop, resize, reset }) {
  const { el, space } = record;
  const bar = el.querySelector(".window-bar");
  const title = el.querySelector(".window-title h2");
  let ignoreDoubleClickUntil = 0;

  bar.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !event.isPrimary || event.target.closest(editable) || !canStart()) return;
    prepare();
    const start = { x: event.clientX, y: event.clientY };
    let dragging = false;
    let ghost;
    let target;
    let placement;
    let last = start;
    let frame;

    function mark(x, y) {
      const hit = document.elementFromPoint(x, y)?.closest(".window");
      const next = hit !== el && hit?.closest(".workspace") === space.el ? hit : null;
      const zone = next ? dropZone(next, x, y) : null;
      if (target === next && placement === zone) return;
      target?.removeAttribute("data-drop-zone");
      target = next;
      placement = zone;
      if (target) target.dataset.dropZone = placement;
    }

    function pan() {
      if (!dragging) return;
      const rect = space.viewport.getBoundingClientRect();
      if (last.y >= rect.top && last.y <= rect.bottom) {
        const threshold = 55;
        const left = clamp((rect.left + threshold - last.x) / threshold, 0, 1);
        const right = clamp((last.x - rect.right + threshold) / threshold, 0, 1);
        if (left || right) {
          const before = space.view.position();
          space.view.move(before + 19 * (right - left));
          if (before !== space.view.position()) mark(last.x, last.y);
        }
      }
      frame = requestAnimationFrame(pan);
    }

    function update(event) {
      const x = event.clientX;
      const y = event.clientY;
      last = { x, y };
      if (!dragging) {
        if (Math.hypot(x - start.x, y - start.y) < 6) return;
        dragging = true;
        space.el.classList.add("is-rearranging");
        el.classList.add("is-drag-source");
        ghost = document.createElement("div");
        ghost.className = "window-drag-preview";
        ghost.textContent = title.textContent;
        ghost.setAttribute("aria-hidden", "true");
        document.body.append(ghost);
        frame = requestAnimationFrame(pan);
      }
      ghost.style.transform = `translate3d(${x + 12}px, ${y + 12}px, 0)`;
      mark(x, y);
    }

    trackPointer(event, bar, update, ({ cancelled }) => {
      if (!dragging) return;
      dragging = false;
      cancelAnimationFrame(frame);
      target?.removeAttribute("data-drop-zone");
      space.el.classList.remove("is-rearranging");
      el.classList.remove("is-drag-source");
      ghost.remove();
      ignoreDoubleClickUntil = performance.now() + 350;
      if (!cancelled && target && canStart()) drop(target.dataset.app, placement);
    });
  });

  bar.addEventListener("dblclick", (event) => {
    if (performance.now() < ignoreDoubleClickUntil) event.stopImmediatePropagation();
  });

  for (const handle of el.querySelectorAll("[data-resize]")) {
    const axis = handle.dataset.resize;
    const direction = handle.dataset.edge === "left" || handle.dataset.edge === "top" ? -1 : 1;
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !event.isPrimary || !canStart()) return;
      event.preventDefault();
      prepare();
      const original = el.getBoundingClientRect();
      const start = axis === "width" ? event.clientX : event.clientY;
      const apply = resize(axis, axis === "width" ? original.width : original.height);
      if (!apply) return;
      space.el.classList.add(`is-resizing-${axis}`);
      let delta = 0;
      trackPointer(event, handle, (event) => {
        const point = axis === "width" ? event.clientX : event.clientY;
        const next = direction * (point - start);
        if (next === delta) return;
        delta = next;
        apply(delta);
      }, ({ cancelled }) => {
        space.el.classList.remove(`is-resizing-${axis}`);
        if (cancelled) apply(null);
        else if (axis === "width" && delta) space.view.reveal(el, true);
      });
    });
    handle.addEventListener("dblclick", () => {
      if (canStart()) reset(axis);
    });
  }
}
