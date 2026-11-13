import { api, session } from "./api.js";
import { $, icon, html } from "./lib.js";
import { busy } from "./ui.js";

const COPY = {
  login: {
    title: "Entra a tu espacio",
    sub: "Continúa donde dejaste tus tableros.",
    submit: "Entrar",
    switchText: "¿Aún no tienes cuenta?",
    switchCta: "Crear una",
    autocomplete: "current-password",
  },
  register: {
    title: "Crea tu cuenta",
    sub: "Tarda menos de un minuto. Sin tarjeta, sin compromiso.",
    submit: "Crear cuenta",
    switchText: "¿Ya tienes cuenta?",
    switchCta: "Entrar",
    autocomplete: "new-password",
  },
};

let mode = "login";

export function initAuth(onAuthenticated) {
  const form = $("#auth-form");
  const error = $("#auth-error");
  const pwd = $("#auth-password");

  const setMode = (next) => {
    mode = next;
    const c = COPY[mode];
    $("#auth-title").textContent = c.title;
    $("#auth-sub").textContent = c.sub;
    $("#auth-submit .btn-label").textContent = c.submit;
    $("#auth-switch-text").textContent = c.switchText;
    $("#auth-switch").textContent = c.switchCta;
    $("#name-field").hidden = mode === "login";
    $("#auth-name").required = mode === "register";
    $("#password-hint").hidden = mode === "login";
    pwd.autocomplete = c.autocomplete;
    error.textContent = "";
  };

  $("#auth-switch").addEventListener("click", () => {
    setMode(mode === "login" ? "register" : "login");
    (mode === "register" ? $("#auth-name") : $("#auth-email")).focus();
  });

  $("#toggle-password").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const show = pwd.type === "password";
    pwd.type = show ? "text" : "password";
    btn.setAttribute("aria-pressed", String(show));
    btn.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
    btn.innerHTML = icon(show ? "eye-off" : "eye");
  });

  $("#use-demo").addEventListener("click", () => {
    setMode("login");
    $("#auth-email").value = "demo@kanban.mx";
    pwd.value = "demo1234";
    $("#auth-submit").focus();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.textContent = "";
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const email = $("#auth-email").value.trim();
    const password = pwd.value;
    const name = $("#auth-name").value.trim();
    if (mode === "register" && password.length < 6) {
      error.textContent = "La contraseña debe tener al menos 6 caracteres.";
      pwd.focus();
      return;
    }
    await busy($("#auth-submit"), async () => {
      try {
        const res = mode === "login" ? await api.login(email, password) : await api.register(name, email, password);
        session.set(res.token, res.user);
        form.reset();
        await onAuthenticated(res.user);
      } catch (err) {
        error.innerHTML = html`${icon("alert")}<span>${err.message}</span>`;
      }
    });
  });

  setMode("login");
}

export function showAuth() {
  $("#app").hidden = true;
  $("#auth").hidden = false;
  document.title = "Entrar · Kanban";
  $("#auth-email").focus();
}
