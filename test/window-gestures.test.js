import assert from "node:assert/strict";
import test from "node:test";
import { trackPointer } from "../window-gestures.js";

function startGesture(pointerType = "mouse") {
  const pointerId = 7;
  const root = new EventTarget();
  const moves = [];
  const endings = [];
  let captured = false;
  function dispatch(type, fields) {
    const event = Object.assign(new Event(type, { cancelable: true }), { pointerId, pointerType, ...fields });
    root.dispatchEvent(event);
    return event;
  }
  const handle = {
    ownerDocument: root,
    setPointerCapture() { captured = true; },
    hasPointerCapture() { return captured; },
    releasePointerCapture() {
      captured = false;
      dispatch("lostpointercapture");
    },
  };
  trackPointer({ pointerId }, handle, ({ clientX }) => moves.push(clientX), (result) => endings.push(result));
  return { moves, endings, dispatch, handle };
}

test("motion after the primary button is released keeps the last pressed preview", () => {
  const { moves, endings, dispatch, handle } = startGesture();
  dispatch("pointermove", { buttons: 1, clientX: 80 });
  dispatch("pointermove", { buttons: 0, clientX: 95 });
  assert.deepEqual(endings, [{ cancelled: false }]);
  dispatch("pointerup", { clientX: 95 });
  dispatch("pointermove", { buttons: 0, clientX: 105 });
  assert.deepEqual(moves, [80]);
  assert.deepEqual(endings, [{ cancelled: false }]);
  assert.equal(handle.hasPointerCapture(), false);
});

for (const type of ["pointerup", "lostpointercapture", "pointercancel"]) {
  test(`${type} settles the mouse gesture once without applying its coordinates`, () => {
    const { moves, endings, dispatch } = startGesture();
    dispatch("pointermove", { pointerId: 8, buttons: 1, clientX: 60 });
    dispatch("pointermove", { buttons: 1, clientX: 80 });
    dispatch(type, { clientX: 0 });
    dispatch("lostpointercapture");
    assert.deepEqual(moves, [80]);
    assert.deepEqual(endings, [{ cancelled: false }]);
  });
}

test("Escape cancels a preview even if a release follows", () => {
  const { endings, dispatch } = startGesture();
  dispatch("pointermove", { buttons: 1, clientX: 80 });
  assert.equal(dispatch("keydown", { key: "Escape" }).defaultPrevented, true);
  dispatch("pointerup");
  assert.deepEqual(endings, [{ cancelled: true }]);
});

test("a browser cancellation rolls back a direct touch gesture", () => {
  const { endings, dispatch } = startGesture("touch");
  dispatch("pointermove", { buttons: 1, clientX: 80 });
  dispatch("pointercancel");
  assert.deepEqual(endings, [{ cancelled: true }]);
});
