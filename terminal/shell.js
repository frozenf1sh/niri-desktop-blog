import { builtInCommands } from "./commands.js";

function tokenize(line) {
  const words = [];
  let word = "";
  let quote = "";
  let escaped = false;
  let started = false;
  for (const ch of line) {
    if (escaped) {
      word += ch;
      escaped = false;
    } else if (ch === "\\" && quote !== "'") {
      escaped = true;
      started = true;
    } else if (quote) {
      if (ch === quote) quote = "";
      else word += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      started = true;
    } else if (/\s/.test(ch)) {
      if (started) words.push(word);
      started = false;
      word = "";
    } else {
      word += ch;
      started = true;
    }
  }
  if (quote) throw new SyntaxError("unmatched quote");
  if (escaped) throw new SyntaxError("incomplete escape");
  if (started) words.push(word);
  return words;
}

export function createShell(context, extraCommands = []) {
  const commands = new Map();
  for (const definition of [...builtInCommands, ...extraCommands]) {
    if (commands.has(definition.name)) throw new Error(`Duplicate command: ${definition.name}`);
    commands.set(definition.name, definition);
  }
  const runtime = { ...context, usages: [...commands.values()].map(({ usage }) => usage) };

  return async function execute(line) {
    let words;
    try {
      words = tokenize(line);
    } catch (error) {
      return { text: `zsh: ${error.message}` };
    }
    if (!words.length) return {};
    const [name, ...args] = words;
    const command = commands.get(name);
    if (!command) return { text: `zsh: command not found: ${name}` };

    try {
      const result = await command.run(args, runtime);
      return typeof result === "string" ? { text: result } : result ?? {};
    } catch {
      return { text: `${name}: command failed` };
    }
  };
}
