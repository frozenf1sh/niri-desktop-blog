export function createWorkspaceViewport(viewport, tiles, navigation, reduceMotion, onStep, onResize) {
  const [previous, next] = navigation.querySelectorAll("button");

  function maxScroll() {
    return viewport.scrollWidth - viewport.clientWidth;
  }

  function updateNavigation() {
    const max = maxScroll();
    navigation.hidden = max < 2;
    previous.disabled = viewport.scrollLeft < 2;
    next.disabled = viewport.scrollLeft > max - 2;
  }

  function position() {
    return viewport.scrollLeft;
  }

  function move(left, smooth = false) {
    viewport.scrollTo({ left, behavior: smooth && !reduceMotion.matches ? "smooth" : "instant" });
  }

  function bounds() {
    const view = viewport.getBoundingClientRect();
    const layout = tiles.getBoundingClientRect();
    const gutter = Math.max(0, (view.width - layout.width) / 2);
    return { left: view.left + gutter, right: view.right - gutter };
  }

  function reveal(el, smooth = false) {
    const view = bounds();
    const tile = el.getBoundingClientRect();
    if (tile.left < view.left - 1) move(position() + tile.left - view.left, smooth);
    else if (tile.right > view.right + 1) move(position() + tile.right - view.right, smooth);
  }

  function step(direction) {
    const view = bounds();
    const columns = [...tiles.querySelectorAll(".tile-column")];
    const target = direction < 0
      ? columns.findLast((el) => el.getBoundingClientRect().left < view.left - 2)
      : columns.find((el) => el.getBoundingClientRect().right > view.right + 2);
    if (!target) return;
    onStep(target.firstElementChild);
    reveal(target, true);
  }

  previous.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));
  viewport.addEventListener("scroll", updateNavigation, { passive: true });
  new ResizeObserver(onResize).observe(tiles);
  viewport.addEventListener("wheel", (event) => {
    if (!event.shiftKey || event.ctrlKey || !event.deltaY || event.deltaX || maxScroll() < 2) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? viewport.clientWidth : 1;
    move(position() + event.deltaY * unit);
  }, { passive: false });

  return { position, move, reveal, updateNavigation };
}
