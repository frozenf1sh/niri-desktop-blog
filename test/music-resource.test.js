import test from "node:test";
import assert from "node:assert/strict";
import { parseLyrics, lyricAt } from "../music/lyrics.js";
import { resolveMonsterSiren } from "../music/adapters/monster-siren.js";

test("lyrics honor timestamps, multiple timestamps, offset and seek position", () => {
  const lines = parseLyrics("[offset:500]\n[00:02.00][00:04.50]hello\n[00:03.00]world\n[ar:artist]");
  assert.deepEqual(lines.map(({ time }) => time), [2.5, 3.5, 5]);
  assert.equal(lyricAt(lines, 2), "");
  assert.equal(lyricAt(lines, 3.7), "world");
  assert.equal(lyricAt(lines, 5), "hello");
});

test("adapter resolves live audio and reuses cached details, album and lyrics", async () => {
  const oldFetch = globalThis.fetch;
  const oldStorage = globalThis.localStorage;
  const storage = new Map();
  const calls = [];
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (url === "/music-api/song/123") return { ok: true, json: async () => ({ code: 0, data: { name: "Song", albumCid: "42", sourceUrl: "https://audio.example/song", lyricUrl: "https://web.hycdn.cn/siren/lyric/20260608/abc.lrc" } }) };
    if (url === "/music-api/album/42/detail") return { ok: true, json: async () => ({ code: 0, data: { coverUrl: "https://web.hycdn.cn/siren/pic/20260608/abc.png" } }) };
    if (url === "/music-media/siren/lyric/20260608/abc.lrc") return { ok: true, text: async () => "[00:01]hi" };
    throw new Error(`unexpected URL ${url}`);
  };
  try {
    const first = await resolveMonsterSiren({ cid: "123" });
    const second = await resolveMonsterSiren({ cid: "123" });
    assert.deepEqual(first, second);
    assert.equal(first.cover, "/music-media/siren/pic/20260608/abc.png");
    assert.equal(first.lyrics, "[00:01]hi");
    assert.equal(calls.length, 3);
    await assert.rejects(resolveMonsterSiren({ cid: "../../bad" }));
  } finally {
    globalThis.fetch = oldFetch;
    globalThis.localStorage = oldStorage;
  }
});
