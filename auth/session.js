// A temporary, in-memory preview. No credentials or accounts are stored.
let user = null;
const listeners = new Set();
export const validUsername = (name) => /^[a-zA-Z0-9_-]{1,32}$/.test(name) && name.toLowerCase() !== "guest";
export const session = {
  get user() { return user; },
  login(username) {
    if (!validUsername(username)) return false;
    user = { username, nickname: username };
    for (const listener of listeners) listener(user);
    return true;
  },
  logout() {
    user = null;
    for (const listener of listeners) listener(user);
  },
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
};
