import assert from "node:assert/strict";
import test from "node:test";
import { session, validUsername } from "../auth/session.js";

test("preview identity rejects invalid names and notifies login and logout", () => {
  const changes = [];
  const unsubscribe = session.subscribe((user) => changes.push(user?.username ?? "guest"));
  assert.equal(validUsername("guest"), false);
  assert.equal(session.login("guest"), false);
  assert.equal(session.login("bad name"), false);
  assert.equal(session.user, null);
  assert.equal(session.login("alice_1"), true);
  assert.equal(session.user.username, "alice_1");
  session.logout();
  unsubscribe();
  assert.deepEqual(changes, ["alice_1", "guest"]);
  assert.equal(session.user, null);
});
