import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createFileSystem } from "../terminal/files.js";
import { profile } from "../terminal/profile.js";
import { createShell } from "../terminal/shell.js";

const baseUrl = new URL("../public/", import.meta.url);
const url = new URL("interests.json", baseUrl);
const interests = await readFile(url, "utf8");

function setup(fetchFile = () => Promise.resolve(new Response(interests)), additions) {
  const files = createFileSystem({ home: profile.home, baseUrl, fetchFile });
  return createShell({ profile, directories: ["文档"], files }, additions);
}

test("kubectl shows Felix's profile and rejects unknown pods", async () => {
  const run = setup();
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
  const run = setup(async (requested) => {
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
  const run = setup(async () => {
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
  const run = setup(async () => new Response(null, { status: 503 }));
  assert.match((await run("cat interests.json")).text, /Input\/output error$/);
  assert.equal((await run("whoami")).text, "felix");
  assert.equal((await run("pwd")).text, "/home/felix");
});

test("the registry handles quoted arguments and lists extra commands in help", async () => {
  const run = setup(undefined, [{ name: "note", usage: "note <text>", run: ([text]) => text }]);
  assert.equal((await run('note "hello   felix"')).text, "hello   felix");
  assert.match((await run("help")).text, /^note <text>$/m);
  assert.match((await run('echo "hello')).text, /unmatched quote/);
  assert.deepEqual(await run("clear"), { clear: true });
});
