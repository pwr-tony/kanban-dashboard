import { html, icon, $, $$ } from "./lib.js";
import { safeStorage } from "./api.js";

const TOAST_ICONS = { success: "check", error: "alert", info: "info" };

export function toast(message, kind = "info", { title } = {}) {
  const region = $("#toasts");
  const node = document.createElement("div");
  node.className = `toast toast-${kind}`;
  node.setAttribute("role", kind === "error" ? "alert" : "status");
  node.innerHTML = html`
    <span class="toast-icon">${icon(TOAST_ICONS[kind] || "info")}</span>
    <div class="toast-body">${title ? html`<strong>${title}</strong>` : ""}<span>${message}</span></div>
    <button class="icon-btn icon-btn-sm" type="button" aria-label="Cerrar aviso">${icon("x")}</button>`;
  const close = () => {
    node.classList.add("leaving");
    setTimeout(() => node.remove(), 180);
  };
  node.querySelector("button").addEventListener("click", close);
  region.appendChild(node);
  while (region.children.length > 3) region.firstElementChild.remove();
  setTimeout(close, kind === "error" ? 6000 : 3800);
}

export function openDialog(content, { size = "md", labelledBy } = {}) {
  const dialog = document.createElement("dialog");
  dialog.className = `dialog dialog-${size}`;
  if (labelledBy) dialog.setAttribute("aria-labelledby", labelledBy);
  dialog.innerHTML = content;
  document.body.appendChild(dialog);

  dialog.addEventListener("mousedown", (e) => {
    if (e.target === dialog) dialog.close("dismiss");
  });
  dialog.addEventListener("close", () => setTimeout(() => dialog.remove(), 200));
  $$("[data-close]", dialog).forEach((b) => b.addEventListener("click", () => dialog.close("dismiss")));
  dialog.showModal();
  const first = $("[autofocus]", dialog) || $("input, select, textarea", dialog);
  if (first) first.focus();
  return dialog;
}

let dialogSeq = 0;

export function formDialog({ title, description, body, submitLabel = "Guardar", danger = false, footerStart, onSubmit, onOpen }) {
  const id = `dlg-${++dialogSeq}`;
  const dialog = openDialog(
    html`
      <form class="dialog-panel" novalidate>
        <header class="dialog-head">
          <div>
            <h2 id="${id}">${title}</h2>
            ${description ? html`<p class="dialog-desc">${description}</p>` : ""}
          </div>
          <button class="icon-btn" type="button" data-close aria-label="Cerrar">${icon("x")}</button>
        </header>
        <div class="dialog-body">${body}</div>
        <p class="form-error" role="alert" data-error></p>
        <footer class="dialog-foot">
          <div class="dialog-foot-start">${footerStart || ""}</div>
          <button class="btn btn-ghost" type="button" data-close>Cancelar</button>
          <button class="btn ${danger ? "btn-danger-solid" : "btn-primary"}" type="submit">${submitLabel}</button>
        </footer>
      </form>`,
    { labelledBy: id }
  );
  const form = $("form", dialog);
  const error = $("[data-error]", dialog);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    error.textContent = "";
    const ok = await busy(form.querySelector('[type="submit"]'), async () => {
      try {
        await onSubmit(form, dialog);
        return true;
      } catch (err) {
        error.textContent = err.message;
        return false;
      }
    });
    if (ok) dialog.close("done");
  });
  if (onOpen) onOpen(dialog, form);
  return dialog;
}

export function confirmDialog({ title, message, confirmLabel = "Confirmar", danger = true }) {
  return new Promise((resolve) => {
    const id = `dlg-${++dialogSeq}`;
    const dialog = openDialog(
      html`
        <div class="dialog-panel">
          <header class="dialog-head">
            <div>
              <h2 id="${id}">${title}</h2>
              <p class="dialog-desc">${message}</p>
            </div>
          </header>
          <footer class="dialog-foot">
            <div class="dialog-foot-start"></div>
            <button class="btn btn-ghost" type="button" data-close>Cancelar</button>
            <button class="btn ${danger ? "btn-danger-solid" : "btn-primary"}" type="button" data-confirm autofocus>${confirmLabel}</button>
          </footer>
        </div>`,
      { size: "sm", labelledBy: id }
    );
    let confirmed = false;
    $("[data-confirm]", dialog).addEventListener("click", () => {
      confirmed = true;
      dialog.close("confirm");
    });
    dialog.addEventListener("close", () => resolve(confirmed), { once: true });
  });
}

export async function busy(button, fn) {
  if (!button) return fn();
  button.disabled = true;
  button.classList.add("is-busy");
  button.setAttribute("aria-busy", "true");
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.classList.remove("is-busy");
    button.removeAttribute("aria-busy");
  }
}

export function setupMenu(menu) {
  if (menu.dataset.ready) return;
  menu.dataset.ready = "1";
  menu.setAttribute("role", "menu");

  menu.addEventListener("toggle", (e) => {
    const trigger = document.querySelector(`[popovertarget="${menu.id}"]`);
    if (trigger) trigger.setAttribute("aria-expanded", String(e.newState === "open"));
    if (e.newState !== "open" || !trigger) return;
    const r = trigger.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    const gap = 6;
    let top = r.bottom + gap;
    if (top + m.height > window.innerHeight - 8) top = Math.max(8, r.top - m.height - gap);
    let left = menu.dataset.align === "start" ? r.left : r.right - m.width;
    left = Math.min(Math.max(8, left), window.innerWidth - m.width - 8);
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    const first = menu.querySelector('[role^="menuitem"]:not([disabled])');
    if (first) first.focus();
  });

  menu.addEventListener("keydown", (e) => {
    const items = $$('[role^="menuitem"]:not([disabled])', menu);
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[next].focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1].focus();
    }
  });

  menu.addEventListener("click", (e) => {
    if (e.target.closest('[role="menuitem"]')) menu.hidePopover();
  });
}

const tip = () => $("#tooltip");

export function showTooltip(target, content) {
  const t = tip();
  t.innerHTML = content;
  t.hidden = false;
  const r = target.getBoundingClientRect();
  const tr = t.getBoundingClientRect();
  let top = r.top - tr.height - 8;
  if (top < 8) top = r.bottom + 8;
  const left = Math.min(Math.max(8, r.left + r.width / 2 - tr.width / 2), window.innerWidth - tr.width - 8);
  t.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

export function hideTooltip() {
  tip().hidden = true;
}

export function bindTooltips() {
  const content = (el) => (el.dataset.tipHtml != null ? el.dataset.tipHtml : html`${el.dataset.tip}`.toString());
  const enter = (e) => {
    const el = e.target.closest?.("[data-tip], [data-tip-html]");
    if (!el) return;
    if (e.type === "focusin" && !el.matches(":focus-visible")) return;
    showTooltip(el, content(el));
  };
  const leave = (e) => {
    const el = e.target.closest?.("[data-tip], [data-tip-html]");
    if (el && !el.contains(e.relatedTarget)) hideTooltip();
  };
  document.addEventListener("mouseover", enter);
  document.addEventListener("mouseout", leave);
  document.addEventListener("focusin", enter);
  document.addEventListener("focusout", leave);
  document.addEventListener("scroll", hideTooltip, true);
}

export const theme = {
  get() {
    const t = safeStorage("get", "theme");
    return t === "light" || t === "dark" ? t : "system";
  },
  set(value) {
    if (value === "system") {
      safeStorage("del", "theme");
      delete document.documentElement.dataset.theme;
    } else {
      safeStorage("set", "theme", value);
      document.documentElement.dataset.theme = value;
    }
  },
};
