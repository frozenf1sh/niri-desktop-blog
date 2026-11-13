export function parseLyrics(text) {
  const lines = [];
  let offset = 0;
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const offsetMatch = line.match(/^\[offset:([+-]?\d+)\]/i);
    if (offsetMatch) offset = Number(offsetMatch[1]) / 1000;
    const words = line.replace(/\[[^\]]*\]/g, "").trim();
    if (!words) continue;
    for (const match of line.matchAll(/\[(\d+):(\d{1,2}(?:\.\d+)?)\]/g)) {
      lines.push({ time: Number(match[1]) * 60 + Number(match[2]), text: words });
    }
  }
  return lines.map((line) => ({ ...line, time: line.time + offset })).sort((a, b) => a.time - b.time);
}

export function lyricAt(lines, time) {
  return lines.findLast((line) => line.time <= time)?.text ?? "";
}
