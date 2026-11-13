const pending = [];
let active = null;

function start({ windows, primary, update, canAnimate }) {
  if (!canAnimate()) {
    update();
    return;
  }
  const root = document.documentElement;
  root.dataset.windowTransition = "";
  const before = primary && !primary.hidden ? primary.getBoundingClientRect() : null;
  for (const { el, app } of windows) {
    el.style.viewTransitionName = el === primary ? "window-active" : `window-${app.id}`;
  }

  let updated = false;
  const apply = () => {
    if (updated) return;
    updated = true;
    update();
    const after = before && !primary.hidden ? primary.getBoundingClientRect() : null;
    const resized = after && (Math.abs(before.width - after.width) > 1 || Math.abs(before.height - after.height) > 1);
    root.toggleAttribute("data-window-resize", Boolean(resized));
  };
  const transition = document.startViewTransition(apply);
  active = { transition, apply };

  function complete() {
    delete root.dataset.windowTransition;
    delete root.dataset.windowResize;
    for (const { el } of windows) el.style.removeProperty("view-transition-name");
    active = null;
    while (!active && pending.length) start(pending.shift());
  }
  transition.ready.catch(() => {});
  transition.updateCallbackDone.catch(() => {});
  transition.finished.then(complete, (error) => {
    complete();
    console.error(error);
  });
}

export function animateWindowLayout(windows, primary, update, canAnimate) {
  const job = { windows, primary, update, canAnimate };
  if (active) pending.push(job);
  else start(job);
}

export function finishWindowLayout() {
  if (!active) return;
  active.transition.skipTransition();
  active.apply();
  for (const { update } of pending.splice(0)) update();
}
