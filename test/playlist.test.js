import assert from "node:assert/strict";
import test from "node:test";
import { createPlaylist } from "../music/playlist.js";

const tracks = ["a", "b", "c", "d"].map((id) => ({ id }));

test("sequence advances at the end of a track and stops at the end of the list", () => {
  const playlist = createPlaylist(tracks, "sequence");
  assert.equal(playlist.advance(1, true).id, "b");
  playlist.select("d");
  assert.equal(playlist.advance(1, true), null);
  assert.equal(playlist.current.id, "d");
  assert.equal(playlist.advance(1).id, "a");
});

test("repeat-one repeats only on playback end and still allows manual skipping", () => {
  const playlist = createPlaylist(tracks, "repeat-one");
  playlist.select("b");
  assert.equal(playlist.advance(1, true).id, "b");
  assert.equal(playlist.advance(1).id, "c");
  assert.equal(playlist.advance(-1).id, "b");
});

test("shuffle visits all other tracks before refilling and preserves previous/next history", () => {
  const playlist = createPlaylist(tracks, "shuffle", () => 0);
  const cycle = [playlist.current.id, ...Array.from({ length: 3 }, () => playlist.advance(1).id)];
  assert.equal(new Set(cycle).size, tracks.length);
  const last = playlist.current;
  const next = playlist.advance(1, true);
  assert.notEqual(last, next);
  assert.equal(playlist.advance(-1), last);
  assert.equal(playlist.advance(1), next);
  assert.equal(playlist.select("missing"), null);
  assert.equal(playlist.current, next);
});


test("exposes only this queue without allowing callers to change it", () => {
  const playlist = createPlaylist(tracks.slice(0, 2), "shuffle");
  const visible = playlist.tracks;
  assert.deepEqual(visible.map((track) => track.id), ["a", "b"]);
  visible.push(tracks[2]);
  assert.equal(playlist.select("c"), null);
  assert.equal(playlist.tracks.length, 2);
});
