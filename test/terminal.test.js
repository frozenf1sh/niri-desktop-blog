import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createFileSystem } from "../terminal/files.js";
import { profile } from "../terminal/profile.js";
import { createShell } from "../terminal/shell.js";

const baseUrl = new URL("../public/", import.meta.url);
const url = new URL("interests.json", baseUrl);
const interests = await readFile(url, "utf8");
const posts = [
  { slug: "browser-terminal", title: "浏览器里的终端", description: "模拟 shell", tags: ["命令行"] },
  { slug: "blog-as-desktop", title: "桌面博客", description: "工作区与阅读器", tags: ["前端"] },
];

function setup(fetchFile = () => Promise.resolve(new Response(interests)), additions) {
  const files = createFileSystem({
    home: profile.home, baseUrl, fetchFile, directories: ["文档"],
    entries: { "文章/browser-terminal.md": { text: "# 浏览器里的终端\n" } },
  });
  return createShell({ profile, files, posts }, additions);
}

test("kubectl shows Felix's profile and rejects unknown pods", async () => {
  const { execute: run } = setup();
  const { text } = await run("kubectl describe pod felix");
  assert.match(text, /^Name:\s+felix$/m);
  assert.match(text, /^Namespace:\s+frozenf1sh\.top$/m);
  assert.match(text, /^Labels:\s+role=backend$/m);
  assert.match(text, /^Annotations:\s+about: 后端开发，喜欢 Linux、容器和终端$/m);
  assert.match(text, /^Status:\s+Running$/m);
  assert.match((await run("kubectl get pods")).text, /^felix\s+Running$/m);
  assert.match((await run("kubectl describe pod unknown")).text, /\(NotFound\)/);
  assert.match((await run("kubectl delete pod felix")).text, /^usage:/);
});

test("cat preserves the actual file text and reads again on each invocation", async () => {
  let current = interests;
  const { execute: run } = setup(async (requested) => {
    assert.equal(requested.href, url.href);
    return new Response(current);
  });
  assert.equal((await run("cat interests.json")).text, interests);
  current = '[\n  "changed"\n]\n';
  assert.equal((await run('cat "./interests.json"')).text, current);
  assert.equal((await run("cat ~/interests.json")).text, current);
  assert.equal((await run("cat /home/felix/interests.json")).text, current);
});

test("cat resolves only registered virtual files", async () => {
  let requests = 0;
  const { execute: run } = setup(async () => {
    requests++;
    return new Response(interests);
  });
  for (const path of ["missing.json", "../interests.json", "/etc/passwd", "https://example.invalid/interests.json"]) {
    assert.match((await run(`cat ${path}`)).text, /No such file or directory$/);
  }
  assert.equal(requests, 0);
  assert.match((await run("ls")).text, /interests\.json/);
});

test("a read failure produces a shell error without breaking later commands", async () => {
  const { execute: run } = setup(async () => new Response(null, { status: 503 }));
  assert.match((await run("cat interests.json")).text, /Input\/output error$/);
  assert.equal((await run("whoami")).text, "felix");
  assert.equal((await run("pwd")).text, "/home/felix");
});

test("the registry handles quoted arguments and lists extra commands in help", async () => {
  const { execute: run } = setup(undefined, [{ name: "note", usage: "note <text>", run: ([text]) => text }]);
  assert.equal((await run('note "hello   felix"')).text, "hello   felix");
  assert.match((await run("help")).text, /^note <text>$/m);
  assert.match((await run('echo "hello')).text, /unmatched quote/);
  assert.deepEqual(await run("clear"), { clear: true });
});

test("cd changes pwd, listing, and relative cat paths without accessing host files", async () => {
  const { execute: run, complete } = setup();
  assert.deepEqual(await run("cd 文章/"), {});
  assert.equal((await run("pwd")).text, "/home/felix/文章");
  assert.equal((await run("ls")).text, "browser-terminal.md");
  assert.equal((await run("cat browser-terminal.md")).text, "# 浏览器里的终端\n");
  assert.match((await run("cat interests.json")).text, /No such file/);
  assert.equal((await run("cat ../interests.json")).text, interests);
  assert.deepEqual(complete("cat ../inte").candidates, [{ value: "../interests.json" }]);
  assert.match((await run("cd /etc")).text, /找不到目录/);
  assert.equal((await run("pwd")).text, "/home/felix/文章");
  await run("cd ..");
  assert.equal((await run("pwd")).text, profile.home);
});

test("search and read use the same posts and help describes commands in Chinese", async () => {
  const { execute: run, complete } = setup();
  assert.deepEqual((await run("search 命令行")).posts, [posts[0]]);
  assert.deepEqual(await run("read browser-terminal.md"), { openPost: "browser-terminal" });
  assert.deepEqual(await run('read "桌面博客"'), { openPost: "blog-as-desktop" });
  assert.match((await run("read missing")).text, /找不到文章/);
  assert.match((await run("help")).text, /^read .*在阅读器中打开文章$/m);
  assert.deepEqual(complete("rea").candidates, [{ value: "read" }]);
  const choice = complete('read "浏览');
  assert.equal(choice.start, 5);
  assert.equal(choice.end, 8);
  assert.equal(choice.candidates[0].value, "浏览器里的终端");
});
