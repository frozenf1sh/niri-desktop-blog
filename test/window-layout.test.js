import assert from "node:assert/strict";
import test from "node:test";
import { copyColumns, distributeHeight, moveTile } from "../window-layout.js";

const ids = (columns) => columns.map(({ windows }) => windows.join(""));

test("swapping windows preserves the column widths and the original snapshot", () => {
  const before = [{ windows: ["A", "B"], width: .4 }, { windows: ["C"], width: .6 }];
  const snapshot = copyColumns(before);
  const after = moveTile(before, "B", "C", "swap");
  assert.deepEqual(ids(after), ["AC", "B"]);
  assert.deepEqual(after.map(({ width }) => width), [.4, .6]);
  assert.deepEqual(before, snapshot);
});

test("stacking and splitting maintain column order and remove empty columns", () => {
  const before = [{ windows: ["A"], width: .65 }, { windows: ["B"], width: null }, { windows: ["C"], width: null }];
  const stacked = moveTile(before, "B", "A", "top");
  assert.deepEqual(ids(stacked), ["BA", "C"]);
  assert.equal(moveTile(stacked, "B", "A", "top"), stacked);
  const split = moveTile(stacked, "B", "A", "right");
  assert.deepEqual(ids(split), ["A", "B", "C"]);
  assert.equal(split[0].width, .65);
  assert.equal(split[1].width, null);
});

test("resized heights share the available space and respect the minimum", () => {
  const sizes = distributeHeight([.45, .12, 0], 602, 112);
  assert.equal(sizes.reduce((sum, height) => sum + height, 0), 602);
  assert.ok(sizes[0] > sizes[1]);
  assert.equal(sizes[2], 112);
  assert.deepEqual(distributeHeight([0, 0], 200, 100), [100, 100]);
});
