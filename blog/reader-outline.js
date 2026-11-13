const previewRadius = 1.55;
const tickSelector = ".reader-outline-tick";
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function mountReaderOutline(scroll, windowId) {
  const outline = document.createElement("nav");
  outline.className = "reader-outline";
  outline.setAttribute("aria-label", "文章目录");
  outline.hidden = true;
  scroll.after(outline);

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let sections = [];
  let current = -1;
  let progressFrame = 0;
  let previewFrame = 0;
  let pointerY = null;
  let press = null;
  let previewed = [];

  function jump(heading) {
    const top = scroll.scrollTop + heading.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 16;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    scroll.scrollTo({ top, behavior: reduceMotion.matches ? "instant" : "smooth" });
  }

  function scheduleProgress() {
    if (progressFrame) return;
    progressFrame = requestAnimationFrame(() => {
      progressFrame = 0;
      if (!sections.length || !scroll.clientHeight) return;
      const top = scroll.getBoundingClientRect().top;
      const atEnd = scroll.scrollTop > 0 && scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop < 2;
      const next = atEnd ? sections.length - 1
        : Math.max(0, sections.findLastIndex(({ heading }) => heading.getBoundingClientRect().top <= top + 54));
      if (next === current) return;
      current = next;
      for (const [index, { button }] of sections.entries()) {
        button.toggleAttribute("data-passed", index < current);
        if (index === current) button.setAttribute("aria-current", "location");
        else button.removeAttribute("aria-current");
      }
      if (pointerY !== null || outline.contains(document.activeElement)) return;
      const area = outline.getBoundingClientRect();
      const row = sections[current].button.getBoundingClientRect();
      if (row.top < area.top) outline.scrollTop += row.top - area.top;
      else if (row.bottom > area.bottom) outline.scrollTop += row.bottom - area.bottom;
    });
  }

  function positionAt(y, area) {
    // Compact rows have a fixed pitch. Scaling the labels leaves their hit areas in place.
    const first = sections[0].button.getBoundingClientRect();
    return (clamp(y, area.top, area.bottom) - first.top) / first.height - .5;
  }

  function clearLabel({ button }) {
    button.style.removeProperty("--outline-scale");
    button.style.removeProperty("--outline-opacity");
  }

  function clearPreview() {
    cancelAnimationFrame(previewFrame);
    previewFrame = 0;
    pointerY = null;
    for (const section of previewed) clearLabel(section);
    previewed = [];
    const id = press?.id;
    press = null;
    if (id !== undefined && outline.hasPointerCapture(id)) outline.releasePointerCapture(id);
  }

  function paintPreview() {
    previewFrame = 0;
    const area = outline.getBoundingClientRect();
    if (!area.height) return;
    if (press && Math.abs(pointerY - press.startY) > 8) {
      const edge = Math.min(32, area.height / 4);
      const up = clamp((area.top + edge - pointerY) / edge, 0, 1);
      const down = clamp((pointerY - area.bottom + edge) / edge, 0, 1);
      const before = outline.scrollTop;
      outline.scrollTop += 7 * (down - up);
      if (outline.scrollTop !== before) schedulePreview();
    }
    const cursor = positionAt(pointerY, area);
    const first = Math.max(0, Math.ceil(cursor - previewRadius));
    const visible = sections.slice(first, Math.floor(cursor + previewRadius) + 1);
    for (const section of previewed) if (!visible.includes(section)) clearLabel(section);
    for (const [offset, { button }] of visible.entries()) {
      const weight = 1 - Math.abs(first + offset - cursor) / previewRadius;
      const emphasis = weight * weight * (3 - 2 * weight);
      button.style.setProperty("--outline-scale", String(.86 + .39 * emphasis));
      button.style.setProperty("--outline-opacity", String(Math.min(1, 2.8 * emphasis)));
    }
    previewed = visible;
  }

  function schedulePreview() {
    if (pointerY !== null && !previewFrame) previewFrame = requestAnimationFrame(paintPreview);
  }

  function followPointer(event) {
    if (press ? event.pointerId !== press.id : event.pointerType === "touch" || !event.target.closest(tickSelector)) return;
    pointerY = event.clientY;
    schedulePreview();
  }

  function endPress(event) {
    if (press?.id !== event.pointerId) return;
    let section;
    if (event.type === "pointerup") {
      const cursor = positionAt(pointerY, outline.getBoundingClientRect());
      section = sections[clamp(Math.round(cursor), 0, sections.length - 1)];
    }
    clearPreview();
    if (section) jump(section.heading);
  }

  outline.addEventListener("pointerover", followPointer);
  outline.addEventListener("pointermove", followPointer);
  outline.addEventListener("pointerleave", () => {
    if (!press) clearPreview();
  });
  outline.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch" || !event.isPrimary || !event.target.closest(tickSelector)) return;
    event.preventDefault();
    press = { id: event.pointerId, startY: event.clientY };
    outline.setPointerCapture(event.pointerId);
    followPointer(event);
  });
  outline.addEventListener("pointerup", endPress);
  outline.addEventListener("pointercancel", endPress);
  outline.addEventListener("lostpointercapture", endPress);
  outline.addEventListener("scroll", schedulePreview, { passive: true });
  scroll.addEventListener("scroll", scheduleProgress, { passive: true });

  const observer = new ResizeObserver(() => {
    scheduleProgress();
    schedulePreview();
  });

  return function setHeadings(headings) {
    clearPreview();
    current = -1;
    sections = [];
    const list = document.createElement("ol");
    const parents = [];
    for (const { id, label, level } of headings) {
      const heading = scroll.querySelector(`#${windowId}-${id}`);
      if (!heading) continue;
      while (parents.at(-1)?.level >= level) parents.pop();
      const parent = parents.at(-1);
      let group = list;
      if (parent) {
        parent.list ??= parent.item.appendChild(document.createElement("ol"));
        group = parent.list;
      }

      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.style.setProperty("--outline-depth", parents.length);
      button.addEventListener("click", () => jump(heading));
      const title = document.createElement("span");
      title.className = "reader-outline-title";
      title.textContent = label;
      const tick = document.createElement("span");
      tick.className = "reader-outline-tick";
      tick.setAttribute("aria-hidden", "true");
      button.append(title, tick);
      item.append(button);
      group.append(item);
      parents.push({ item, level });
      sections.push({ heading, button });
    }
    outline.replaceChildren(list);
    outline.hidden = !sections.length;
    outline.scrollTop = 0;
    observer.disconnect();
    observer.observe(scroll);
    if (scroll.firstElementChild) observer.observe(scroll.firstElementChild);
    scheduleProgress();
  };
}
