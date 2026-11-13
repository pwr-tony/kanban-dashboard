
class SafeHTML {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);

function serialize(v) {
  if (v == null || v === false) return "";
  if (Array.isArray(v)) return v.map(serialize).join("");
  if (v instanceof SafeHTML) return v.value;
  return escape(v);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => (out += serialize(v) + strings[i + 1]));
  return new SafeHTML(out);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const icon = (name, cls = "") =>
  html`<svg class="icon ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;

export const safeColor = (c) => (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c || "") ? c : "#8a8984");

export const initials = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase() || "·";

const nf = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });
export const num = (n) => nf.format(n);

export function duration(hours) {
  if (hours == null || Number.isNaN(hours)) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${num(hours)} h`;
  return `${num(hours / 24)} d`;
}

export function debounce(fn, ms = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
