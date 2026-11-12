import { createFileSystem } from "./files.js";
import { banner, profile, welcomeCommands } from "./profile.js";
import { createShell } from "./shell.js";

export function mountTerminal(root, directories, baseUrl) {
  root.innerHTML = `<div class="terminal-shell" data-scroll>
    <div class="terminal-history" role="log"></div>
    <form class="terminal-form"><input class="terminal-input" aria-label="命令" placeholder="▌"
      autocomplete="off" autocapitalize="off" spellcheck="false"></form>
  </div>`;
  const shell = root.firstElementChild;
  const history = root.querySelector(".terminal-history");
  const form = root.querySelector(".terminal-form");
  const input = root.querySelector(".terminal-input");
  const files = createFileSystem({
    home: profile.home,
    baseUrl,
  });
  const execute = createShell({ profile, directories, files });
  const commands = [...welcomeCommands];
  let cursor = commands.length;
  let queue = Promise.resolve();

  function prompt() {
    const span = document.createElement("span");
    span.className = "terminal-prompt";
    span.setAttribute("aria-hidden", "true");
    span.textContent = `${profile.username}@${profile.hostname}:~$ `;
    return span;
  }
  form.prepend(prompt());

  function print(text, kind = "output") {
    const row = document.createElement("p");
    row.className = `terminal-row ${kind}`;
    if (kind === "command") row.append(prompt());
    row.append(text);
    history.append(row);
    if (history.childElementCount > 120) history.firstElementChild.remove();
  }

  const revealPrompt = () => { shell.scrollTop = shell.scrollHeight; };
  function run(line, follow = false) {
    queue = queue.then(async () => {
      print(line, "command");
      const result = await execute(line);
      if (result.clear) history.replaceChildren();
      if (result.text !== undefined) print(result.text, result.kind === "directories" ? "output directories" : "output");
      if (follow || document.activeElement === input) revealPrompt();
    });
  }

  print(banner);
  for (const line of welcomeCommands) run(line);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    input.value = "";
    if (!value) return;
    commands.push(value);
    if (commands.length > 60) commands.shift();
    cursor = commands.length;
    run(value, true);
  });

  input.addEventListener("keydown", (event) => {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    cursor = Math.max(0, Math.min(commands.length, cursor + (event.key === "ArrowUp" ? -1 : 1)));
    input.value = commands[cursor] ?? "";
  });
  input.addEventListener("focus", revealPrompt);
  shell.addEventListener("click", () => {
    if (!getSelection()?.isCollapsed) return;
    input.focus({ preventScroll: true });
    revealPrompt();
  });
}
