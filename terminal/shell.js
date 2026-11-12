import { builtInCommands } from "./commands.js";

export function scanCommand(line) {
  const tokens = [];
  let word = "";
  let start = -1;
  let quote = "";
  let escaped = false;

  function finish(end) {
    if (start < 0) return;
    tokens.push({ value: word, start, end });
    word = "";
    start = -1;
  }

  for (let index = 0; index < line.length; index++) {
    const ch = line[index];
    if (!quote && !escaped && /\s/.test(ch)) {
      finish(index);
      continue;
    }
    if (start < 0) start = index;
    if (escaped) {
      word += ch;
      escaped = false;
    } else if (ch === "\\" && quote !== "'") {
      escaped = true;
    } else if (quote) {
      if (ch === quote) quote = "";
      else word += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else {
      word += ch;
    }
  }
  finish(line.length);
  const error = quote ? "unmatched quote" : escaped ? "incomplete escape" : null;
  return { tokens, error };
}

export function createShell(context, extraCommands = []) {
  const definitions = [...builtInCommands, ...extraCommands];
  const commands = new Map();
  for (const definition of definitions) {
    if (commands.has(definition.name)) throw new Error(`Duplicate command: ${definition.name}`);
    commands.set(definition.name, definition);
  }
  const session = { cwd: context.profile.home };
  const runtime = { posts: [], ...context, session, definitions };

  async function execute(line) {
    const { tokens, error } = scanCommand(line);
    if (error) return { text: `zsh: ${error}`, kind: "error" };
    if (!tokens.length) return {};
    const [name, ...args] = tokens.map(({ value }) => value);
    const command = commands.get(name);
    if (!command) return { text: `zsh: command not found: ${name}`, kind: "error" };

    try {
      const result = await command.run(args, runtime);
      return typeof result === "string" ? { text: result } : result ?? {};
    } catch {
      return { text: `${name}: command failed`, kind: "error" };
    }
  }

  function complete(line, caret = line.length) {
    const before = scanCommand(line.slice(0, caret)).tokens;
    const token = before.at(-1)?.end === caret ? before.pop() : null;
    const prefix = token?.value ?? "";
    const start = token?.start ?? caret;
    const end = scanCommand(line).tokens.find((item) => item.start === start)?.end ?? caret;
    const [name, ...args] = before.map(({ value }) => value);
    const choices = name === undefined
      ? [...commands.keys()]
      : commands.get(name)?.complete?.({ args, prefix }, runtime) ?? [];
    const candidates = choices.map((choice) => typeof choice === "string" ? { value: choice } : choice)
      .filter(({ value }) => value.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase()));
    return { start, end, prefix, candidates };
  }

  return { execute, complete, get cwd() { return session.cwd; } };
}
