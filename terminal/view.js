import { session, validUsername } from "../auth/session.js";
import { createFileSystem } from "./files.js";
import { appendCommand, appendJson } from "./highlight.js";
import { banner, profile, welcomeCommands } from "./profile.js";
import { createShell } from "./shell.js";
import "./terminal.css";

export function mountTerminal(root, { directories, baseUrl, posts, postHref, openArticle, windowId, closeWindow }) {
  root.innerHTML = `<div class="terminal-shell" data-scroll>
    <div class="terminal-history" role="log"></div>
    <form class="terminal-form">
      <span class="terminal-prompt" aria-hidden="true"></span>
      <div class="terminal-input-wrap">
        <div class="terminal-input-ink" aria-hidden="true"></div>
        <input class="terminal-input" role="combobox" aria-label="命令" aria-autocomplete="list"
          aria-expanded="false" aria-controls="${windowId}-completions" placeholder="▌"
          autocomplete="off" autocapitalize="off" spellcheck="false">
      </div>
    </form>
    <div class="terminal-completions" id="${windowId}-completions" role="listbox" aria-label="补全候选" hidden></div>
  </div>`;
  const shell = root.firstElementChild;
  const history = root.querySelector(".terminal-history");
  const form = root.querySelector(".terminal-form");
  const formPrompt = form.querySelector(".terminal-prompt");
  const input = root.querySelector(".terminal-input");
  const ink = root.querySelector(".terminal-input-ink");
  const suggestions = root.querySelector(".terminal-completions");
  const files = createFileSystem({
    home: profile.home,
    baseUrl,
    directories,
    entries: Object.fromEntries(posts.map(({ slug, source }) => [`文章/${slug}.md`, { text: source }])),
  });
  const terminal = createShell({ profile, files, posts, currentUser: () => session.user?.username ?? "guest" }, [
    { name: "su", usage: "su <用户名>", description: "切换账号", run: (args) => {
      if (args.length !== 1 || !validUsername(args[0])) return { text: "usage: su <用户名>（字母、数字、_ 或 -，不能为 guest）", kind: "error" };
      return { passwordFor: args[0] };
    } },
    { name: "exit", usage: "exit", description: "退出账号或关闭终端", run: (args) => {
      if (args.length) return "usage: exit";
      const username = session.user?.username;
      if (!username) return { closeWindow: true };
      session.logout();
      return `已退出 ${username}。`;
    } },
  ]);
  const commands = [...welcomeCommands];
  let cursor = commands.length;
  let queue = Promise.resolve();
  let completing = null;
  let selected = 0;
  let composing = false;
  let passwordFor = null;
  let passwordInput = null;

  function promptText() {
    const cwd = terminal.cwd;
    const shown = cwd === profile.home || cwd.startsWith(profile.home + "/")
      ? "~" + cwd.slice(profile.home.length)
      : cwd;
    return `${session.user?.username ?? "guest"}@${profile.hostname}:${shown}$ `;
  }

  function appendRow(row) {
    history.append(row);
    if (history.childElementCount > 120) history.firstElementChild.remove();
  }

  function printCommand(line) {
    const row = document.createElement("p");
    row.className = "terminal-row command";
    const span = document.createElement("span");
    span.className = "terminal-prompt";
    span.setAttribute("aria-hidden", "true");
    span.textContent = promptText();
    row.append(span);
    appendCommand(row, line);
    appendRow(row);
  }

  function print(text, kind = "output") {
    const row = document.createElement("p");
    row.className = kind === "output" ? "terminal-row output" : `terminal-row output ${kind}`;
    if (kind === "json") appendJson(row, text);
    else row.textContent = text;
    appendRow(row);
  }

  function printPosts(matches) {
    const list = document.createElement("ul");
    list.className = "terminal-results";
    for (const post of matches) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = postHref(post.slug);
      link.dataset.blogLink = "";
      link.textContent = post.title;
      const slug = document.createElement("span");
      slug.textContent = post.slug;
      item.append(link, slug);
      list.append(item);
    }
    appendRow(list);
  }

  const revealPrompt = () => { shell.scrollTop = shell.scrollHeight; };
  function run(line, follow = false) {
    queue = queue.then(async () => {
      printCommand(line);
      const result = await terminal.execute(line);
      if (result.passwordFor) {
        passwordFor = result.passwordFor;
        passwordInput = document.createElement("input");
        passwordInput.type = "password";
        passwordInput.className = "terminal-input terminal-password";
        passwordInput.setAttribute("aria-label", "密码");
        passwordInput.autocomplete = "off";
        passwordInput.spellcheck = false;
        // Keep password entry outside the command form's submission and history.
        passwordInput.setAttribute("form", "");
        input.hidden = true;
        ink.hidden = true;
        input.parentElement.append(passwordInput);
        passwordInput.addEventListener("keydown", handlePasswordKey);
        passwordInput.focus({ preventScroll: true });
      }
      if (result.closeWindow) { closeWindow(); return; }
      if (result.clear) history.replaceChildren();
      if (result.text !== undefined) print(result.text, result.kind);
      if (result.posts) printPosts(result.posts);
      formPrompt.textContent = passwordFor ? "密码：" : promptText();
      if (follow || document.activeElement === input) revealPrompt();
      if (result.openPost) openArticle(result.openPost, { origin: input, keyboard: true });
    });
  }

  session.subscribe(() => {
    if (!passwordFor) formPrompt.textContent = promptText();
  });
  function endPassword() {
    passwordFor = null;
    if (passwordInput) {
      passwordInput.value = "";
      passwordInput.remove();
      passwordInput = null;
    }
    input.hidden = false;
    ink.hidden = false;
    formPrompt.textContent = promptText();
    paintInput();
    input.focus({ preventScroll: true });
  }
  function handlePasswordKey(event) {
    if (event.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      endPassword();
      print("已取消。");
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (!passwordInput.value) return;
      const username = passwordFor;
      endPassword();
      session.login(username);
      print(`已切换到 ${username}。`);
      revealPrompt();
    }
  }

  const art = document.createElement("pre");
  art.className = "terminal-banner";
  art.setAttribute("role", "img");
  art.setAttribute("aria-label", "Felix");
  art.textContent = banner;
  appendRow(art);
  formPrompt.textContent = promptText();
  for (const line of welcomeCommands) run(line);

  function syncInkScroll() {
    ink.scrollLeft = input.scrollLeft;
  }

  function paintInput() {
    ink.replaceChildren();
    appendCommand(ink, input.value);
    syncInkScroll();
    requestAnimationFrame(syncInkScroll);
  }

  function hideSuggestions() {
    completing = null;
    suggestions.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }

  function accept(candidate, { start, end }) {
    const raw = candidate.value;
    const value = /[\s"'\\]/.test(raw) ? '"' + raw.replace(/["\\]/g, "\\$&") + '"' : raw;
    const suffix = input.value.slice(end);
    const space = raw.endsWith("/") || /^\s/.test(suffix) ? "" : " ";
    input.setRangeText(value + space, start, end, "end");
    hideSuggestions();
    paintInput();
    input.focus({ preventScroll: true });
    revealPrompt();
  }

  function selectCandidate(index) {
    const options = [...suggestions.children];
    selected = (index + options.length) % options.length;
    options.forEach((option, position) => option.setAttribute("aria-selected", String(position === selected)));
    const option = options[selected];
    input.setAttribute("aria-activedescendant", option.id);
    if (option.offsetTop < suggestions.scrollTop) suggestions.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > suggestions.scrollTop + suggestions.clientHeight) {
      suggestions.scrollTop = option.offsetTop + option.offsetHeight - suggestions.clientHeight;
    }
  }

  function showSuggestions(completion) {
    completing = completion;
    const options = completion.candidates.map((candidate, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.tabIndex = -1;
      option.id = `${windowId}-option-${index}`;
      option.setAttribute("role", "option");
      option.textContent = candidate.label ?? candidate.value;
      option.addEventListener("pointerdown", (event) => event.preventDefault());
      option.addEventListener("click", () => accept(candidate, completion));
      return option;
    });
    suggestions.replaceChildren(...options);
    suggestions.hidden = false;
    input.setAttribute("aria-expanded", "true");
    selectCandidate(0);
    revealPrompt();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (composing) return;
    if (passwordFor) return;
    const value = input.value.trim();
    input.value = "";
    hideSuggestions();
    paintInput();
    if (!value) return;
    commands.push(value);
    if (commands.length > 60) commands.shift();
    cursor = commands.length;
    run(value, true);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      if (composing || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      if (completing) {
        selectCandidate(selected + (event.shiftKey ? -1 : 1));
        return;
      }
      if (event.shiftKey || !input.value.trim()) return;
      const completion = terminal.complete(input.value, input.selectionStart);
      if (completion.candidates.length === 1) accept(completion.candidates[0], completion);
      else if (completion.candidates.length > 1) showSuggestions(completion);
      return;
    }
    if (composing || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (completing) {
      if (event.key === "Escape") {
        event.preventDefault();
        hideSuggestions();
      } else if (event.key === "Enter") {
        event.preventDefault();
        accept(completing.candidates[selected], completing);
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        selectCandidate(selected + (event.key === "ArrowUp" ? -1 : 1));
      }
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    cursor = Math.max(0, Math.min(commands.length, cursor + (event.key === "ArrowUp" ? -1 : 1)));
    input.value = commands[cursor] ?? "";
    paintInput();
  });
  input.addEventListener("input", () => {
    hideSuggestions();
    if (!passwordFor) paintInput();
  });
  input.addEventListener("compositionstart", () => {
    composing = true;
    form.classList.add("is-composing");
  });
  input.addEventListener("compositionend", () => {
    composing = false;
    form.classList.remove("is-composing");
    if (!passwordFor) paintInput();
  });
  input.addEventListener("scroll", syncInkScroll);
  input.addEventListener("blur", hideSuggestions);
  input.addEventListener("focus", revealPrompt);
  shell.addEventListener("click", (event) => {
    if (event.target.closest("a, button, input") || !getSelection()?.isCollapsed) return;
    (passwordInput ?? input).focus({ preventScroll: true });
    revealPrompt();
  });
  return { close() { if (passwordInput) endPassword(); } };
}
