import { session } from "./api.js";
import { $ } from "./lib.js";
import { bindTooltips, toast } from "./ui.js";
import { initAuth, showAuth } from "./auth.js";
import { enterApp, leaveApp } from "./app.js";

function logout(message) {
  session.clear();
  leaveApp();
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  showAuth();
  if (message) toast(message, "info");
}

session.onUnauthorized(() => logout("Tu sesión expiró. Vuelve a entrar para continuar."));
$("#logout").addEventListener("click", () => logout());

bindTooltips();
initAuth((user) => enterApp(user));

const user = session.user();
if (session.token && user) {
  enterApp(user).catch((err) => {
    if (err.status !== 401) logout(err.message);
  });
} else {
  showAuth();
}
document.documentElement.classList.add("ready");
