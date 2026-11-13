export function columnOf(columns, window) {
  return columns.find((column) => column.windows.includes(window));
}

export function copyColumns(columns) {
  return columns.map(({ windows, width }) => ({ windows: [...windows], width }));
}

export function removeTile(columns, window) {
  const column = columnOf(columns, window);
  if (!column) return;
  column.windows.splice(column.windows.indexOf(window), 1);
  if (!column.windows.length) columns.splice(columns.indexOf(column), 1);
  return column;
}

export function distributeHeight(weights, total, minimum) {
  const available = Math.max(0, total - minimum * weights.length);
  const sum = weights.reduce((value, weight) => value + weight, 0);
  return weights.map((weight) => minimum + available * (sum > 0 ? weight / sum : 1 / weights.length));
}

export function moveTile(columns, source, target, placement) {
  if (source === target) return columns;
  const next = copyColumns(columns);
  const from = columnOf(next, source);
  const into = columnOf(next, target);
  if (!from || !into) return columns;

  const fromIndex = from.windows.indexOf(source);
  const toIndex = into.windows.indexOf(target);
  if (placement === "swap") {
    from.windows[fromIndex] = target;
    into.windows[toIndex] = source;
  } else {
    const horizontal = placement === "left" || placement === "right";
    const after = placement === "right" || placement === "bottom";
    if (horizontal && from.windows.length === 1
        && (from === into || next.indexOf(from) - next.indexOf(into) === (after ? 1 : -1))) return columns;
    if (!horizontal && from === into && fromIndex - toIndex === (after ? 1 : -1)) return columns;
    from.windows.splice(fromIndex, 1);
    if (!from.windows.length) next.splice(next.indexOf(from), 1);
    if (horizontal) {
      next.splice(next.indexOf(into) + Number(after), 0, {
        windows: [source],
        width: from === into ? null : from.width,
      });
    } else {
      into.windows.splice(into.windows.indexOf(target) + Number(after), 0, source);
    }
  }
  return next;
}
