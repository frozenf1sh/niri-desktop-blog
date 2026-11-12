import { scanCommand } from "./shell.js";

function appendToken(root, text, type) {
  if (!type) {
    root.append(text);
    return;
  }
  const span = document.createElement("span");
  span.className = `terminal-token terminal-token-${type}`;
  span.textContent = text;
  root.append(span);
}

export function appendCommand(root, line) {
  const { tokens } = scanCommand(line);
  let offset = 0;
  for (const [index, { start, end, value }] of tokens.entries()) {
    const raw = line.slice(start, end);
    let type;
    if (index === 0) type = "command";
    else if (raw.startsWith('"') || raw.startsWith("'")) type = "string";
    else if (value.startsWith("-")) type = "option";
    else if (value.includes("/") || /\.(json|md|txt)$/.test(value)) type = "path";
    root.append(line.slice(offset, start));
    appendToken(root, raw, type);
    offset = end;
  }
  root.append(line.slice(offset));
}

export function appendJson(root, text) {
  const tokens = /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|\b(?:true|false|null)\b/gi;
  let offset = 0;
  for (const match of text.matchAll(tokens)) {
    root.append(text.slice(offset, match.index));
    appendToken(root, match[0], match[0].startsWith('"') ? "string" : "option");
    offset = match.index + match[0].length;
  }
  root.append(text.slice(offset));
}
