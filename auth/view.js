import { session, validUsername } from "./session.js";

export function mountAuth() {
  const dialog = document.querySelector("#auth-dialog");
  const form = dialog.querySelector("form");
  const fields = dialog.querySelector("#auth-register-fields");
  const switcher = dialog.querySelector(".auth-switch");
  const error = dialog.querySelector(".auth-error");
  const action = document.querySelector("#account-action");
  let registering = false;
  function render() {
    const user = session.user;
    document.querySelector("#account-name").textContent = user?.nickname ?? "访客";
    document.querySelector("#account-status").textContent = user ? `@${user.username}` : "未登录";
    document.querySelector("#account-avatar").textContent = user ? user.nickname[0].toUpperCase() : "G";
    action.textContent = user ? "退出" : "登录";
  }
  function setMode(value) {
    registering = value;
    fields.hidden = !value;
    fields.querySelector('[name="email"]').required = value;
    form.elements.password.autocomplete = value ? "new-password" : "current-password";
    dialog.querySelector("#auth-title").textContent = value ? "注册" : "登录";
    dialog.querySelector(".auth-submit").textContent = value ? "注册" : "登录";
    switcher.querySelector("span").textContent = value ? "已经有账号？" : "还没有账号？";
    switcher.querySelector("button").textContent = value ? "返回登录" : "创建账号";
    error.hidden = true;
    form.elements.password.value = "";
  }
  action.addEventListener("click", () => {
    if (session.user) { session.logout(); return; }
    setMode(false);
    dialog.showModal();
    form.elements.username.focus();
  });
  switcher.querySelector("button").addEventListener("click", () => setMode(!registering));
  dialog.querySelector(".auth-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { form.reset(); error.hidden = true; });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = form.elements.username.value.trim();
    if (!validUsername(username)) {
      error.textContent = "用户名只能包含字母、数字、下划线或连字符，且不能为 guest。";
      error.hidden = false;
      return;
    }
    session.login(username);
    dialog.close();
  });
  session.subscribe(render);
  render();
}
