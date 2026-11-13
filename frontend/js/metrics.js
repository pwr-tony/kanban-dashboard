import { api } from "./api.js";
import { $, html, icon, num, duration } from "./lib.js";
import { store } from "./store.js";

const modes = { wip: "chart", cycle: "chart" };
let last = null;
let bound = false;
let requestSeq = 0;

export async function renderMetrics() {
  const root = $("#metrics-view");
  bindOnce(root);
  if (!store.board) return;

  root.innerHTML = skeleton();
  root.setAttribute("aria-busy", "true");
  const seq = ++requestSeq;
  try {
    const m = await api.metrics(store.board.id);
    if (seq !== requestSeq) return;
    last = m;
    paint(root, m);
  } catch (err) {
    if (seq !== requestSeq) return;
    root.innerHTML = html`
      <div class="empty empty-compact">
        <h2>No se pudieron cargar las métricas</h2>
        <p>${err.message}</p>
        <button class="btn" type="button" data-retry>${icon("refresh")}Reintentar</button>
      </div>`;
  } finally {
    root.removeAttribute("aria-busy");
  }
}

function paint(root, m) {
  const ct = m.cycle_time;
  const limited = m.columns.filter((c) => c.wip_limit > 0);
  const inFlight = limited.reduce((s, c) => s + c.card_count, 0);
  const capacity = limited.reduce((s, c) => s + c.wip_limit, 0);
  const over = m.columns.filter((c) => c.over_limit);

  root.innerHTML = html`
    <div class="stats">
      ${stat("Tarjetas", num(m.total_cards), `en ${m.columns.length} ${m.columns.length === 1 ? "columna" : "columnas"}`)}
      ${stat(
        "Trabajo en curso",
        num(inFlight),
        capacity ? `de ${num(capacity)} permitidas por los límites` : "ninguna columna tiene límite",
        over.length ? html`<span class="stat-flag">${icon("alert")}${over.length} sobre el límite</span>` : ""
      )}
      ${stat("Completadas", num(ct.completed_cards), "con cycle time medido")}
      ${stat("Cycle time promedio", ct.completed_cards ? duration(ct.avg_hours) : "—", ct.completed_cards ? `mín. ${duration(ct.min_hours)} · máx. ${duration(ct.max_hours)}` : "aún sin tarjetas terminadas")}
    </div>

    <div class="panels">
      ${panel("wip", "WIP por columna", "Tarjetas actuales frente al límite de cada etapa.", wipBody(m))}
      ${panel("cycle", "Cycle time por tarjeta", "Tiempo desde que entró a “En progreso” hasta que llegó a “Hecho”.", cycleBody(ct))}
    </div>`;
}

const stat = (label, value, sub, extra = "") => html`
  <div class="stat">
    <span class="stat-label">${label}</span>
    <span class="stat-value">${value}</span>
    <span class="stat-sub">${sub}</span>
    ${extra}
  </div>`;

function panel(key, title, sub, body) {
  const mode = modes[key];
  return html`
    <section class="panel" aria-labelledby="panel-${key}">
      <header class="panel-head">
        <div>
          <h2 id="panel-${key}">${title}</h2>
          <p>${sub}</p>
        </div>
        <div class="view-toggle" role="group" aria-label="Formato de ${title}">
          <button type="button" data-mode="chart" data-panel="${key}" aria-pressed="${mode === "chart"}">${icon("chart")}<span class="sr-only">Gráfica</span></button>
          <button type="button" data-mode="table" data-panel="${key}" aria-pressed="${mode === "table"}">${icon("table")}<span class="sr-only">Tabla</span></button>
        </div>
      </header>
      ${body}
    </section>`;
}

function ticks(max) {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) || mag * 10;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const out = [];
  for (let v = 0; v <= top + 1e-9; v += step) out.push(+v.toFixed(6));
  return { top, values: out };
}

const axis = (t, fmt) => html`
  <div class="axis" aria-hidden="true">
    ${t.values.map((v) => html`<span style="left:${(v / t.top) * 100}%">${fmt(v)}</span>`)}
  </div>`;

const grid = (t) => html`<div class="gridlines" aria-hidden="true">${t.values.map((v) => html`<i style="left:${(v / t.top) * 100}%"></i>`)}</div>`;

function wipBody(m) {
  if (!m.columns.length) return html`<p class="panel-empty">Este tablero aún no tiene columnas.</p>`;

  if (modes.wip === "table") {
    return html`
      <table class="data-table">
        <thead><tr><th scope="col">Columna</th><th scope="col" class="num">Tarjetas</th><th scope="col" class="num">Límite</th><th scope="col">Estado</th></tr></thead>
        <tbody>
          ${m.columns.map(
            (c) => html`<tr>
              <th scope="row">${c.name}</th>
              <td class="num">${c.card_count}</td>
              <td class="num">${c.wip_limit || "—"}</td>
              <td>${c.over_limit ? html`<span class="status status-critical">${icon("alert")}Sobre el límite</span>` : c.wip_limit && c.card_count === c.wip_limit ? "En el límite" : "Con espacio"}</td>
            </tr>`
          )}
        </tbody>
      </table>`;
  }

  const t = ticks(Math.max(1, ...m.columns.map((c) => Math.max(c.card_count, c.wip_limit))));
  return html`
    <div class="chart" role="list" aria-label="WIP por columna">
      <div class="chart-plot">
        ${grid(t)}
        ${m.columns.map((c) => {
          const value = c.wip_limit ? `${c.card_count} / ${c.wip_limit}` : `${c.card_count}`;
          const tip = html`<strong>${c.name}</strong><span>${c.card_count} ${c.card_count === 1 ? "tarjeta" : "tarjetas"}</span><span>${c.wip_limit ? `Límite: ${c.wip_limit}` : "Sin límite"}</span>${c.over_limit ? html`<span class="tip-alert">Sobre el límite</span>` : ""}`;
          return html`
            <div class="bar-row" role="listitem" tabindex="0" data-tip-html="${String(tip)}"
                 aria-label="${c.name}: ${c.card_count} tarjetas${c.wip_limit ? `, límite ${c.wip_limit}` : ", sin límite"}${c.over_limit ? ", sobre el límite" : ""}">
              <span class="bar-name">${c.name}</span>
              <span class="bar-track">
                ${c.card_count ? html`<i class="bar ${c.over_limit ? "bar-critical" : ""}" style="width:${(c.card_count / t.top) * 100}%"></i>` : ""}
                ${c.wip_limit ? html`<i class="limit-mark" style="left:${(c.wip_limit / t.top) * 100}%"></i>` : ""}
              </span>
              <span class="bar-value">${c.over_limit ? html`${icon("alert", "icon-critical")}` : ""}${value}</span>
            </div>`;
        })}
      </div>
      ${axis(t, (v) => num(v))}
    </div>
    <div class="legend" aria-hidden="true">
      <span><i class="key key-bar"></i>Tarjetas</span>
      <span><i class="key key-limit"></i>Límite de WIP</span>
      ${m.columns.some((c) => c.over_limit) ? html`<span><i class="key key-critical"></i>Sobre el límite</span>` : ""}
    </div>`;
}

function cycleBody(ct) {
  if (!ct.completed_cards) {
    return html`
      <div class="panel-empty">
        ${icon("clock")}
        <p>Cuando una tarjeta pase de “En progreso” a “Hecho”, aquí verás cuánto tardó.</p>
      </div>`;
  }
  const titleOf = (id) => store.board?.cards.find((c) => c.id === id)?.title || `Tarjeta #${id}`;
  const rows = [...ct.per_card].sort((a, b) => b.hours - a.hours);

  if (modes.cycle === "table") {
    return html`
      <table class="data-table">
        <thead><tr><th scope="col">Tarjeta</th><th scope="col" class="num">Cycle time</th><th scope="col" class="num">Horas</th></tr></thead>
        <tbody>
          ${rows.map((p) => html`<tr><th scope="row">${titleOf(p.card_id)} <span class="muted mono">#${p.card_id}</span></th><td class="num">${duration(p.hours)}</td><td class="num">${num(p.hours)}</td></tr>`)}
        </tbody>
        <tfoot><tr><th scope="row">Promedio</th><td class="num">${duration(ct.avg_hours)}</td><td class="num">${num(ct.avg_hours)}</td></tr></tfoot>
      </table>`;
  }

  const maxHours = Math.max(...rows.map((p) => p.hours), ct.avg_hours);
  const unit = maxHours >= 48 ? 24 : 1;
  const tu = ticks(maxHours / unit);
  const t = { top: tu.top * unit, values: tu.values.map((v) => v * unit) };
  const axisLabel = (h) => (h === 0 ? "0" : `${num(h / unit)} ${unit === 24 ? "d" : "h"}`);
  const avgPos = (ct.avg_hours / t.top) * 100;
  return html`
    <div class="chart" role="list" aria-label="Cycle time por tarjeta">
      <div class="chart-plot">
        ${grid(t)}
        <div class="plot-layer" aria-hidden="true"><div class="avg-rule" style="left:${avgPos}%"><span>Prom. ${duration(ct.avg_hours)}</span></div></div>
        ${rows.map((p) => {
          const name = titleOf(p.card_id);
          const vsAvg = p.hours > ct.avg_hours ? "por encima del promedio" : "por debajo del promedio";
          const tip = html`<strong>${name}</strong><span>${duration(p.hours)} (${num(p.hours)} h)</span><span>${vsAvg}</span>`;
          return html`
            <div class="bar-row" role="listitem" tabindex="0" data-tip-html="${String(tip)}" aria-label="${name}: ${duration(p.hours)}, ${vsAvg}">
              <span class="bar-name">${name}</span>
              <span class="bar-track"><i class="bar" style="width:${(p.hours / t.top) * 100}%"></i></span>
              <span class="bar-value">${duration(p.hours)}</span>
            </div>`;
        })}
      </div>
      ${axis(t, axisLabel)}
    </div>
    <div class="legend" aria-hidden="true">
      <span><i class="key key-bar"></i>Cycle time</span>
      <span><i class="key key-avg"></i>Promedio</span>
    </div>`;
}

function skeleton() {
  return html`
    <div class="stats">${[1, 2, 3, 4].map(() => html`<div class="stat skeleton"><i></i><i></i><i></i></div>`)}</div>
    <div class="panels">${[1, 2].map(() => html`<div class="panel skeleton skeleton-panel"><i></i><i></i><i></i><i></i></div>`)}</div>`;
}

function bindOnce(root) {
  if (bound) return;
  bound = true;
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-retry]")) return renderMetrics();
    const b = e.target.closest("[data-mode]");
    if (!b || !last) return;
    modes[b.dataset.panel] = b.dataset.mode;
    paint(root, last);
    $(`[data-panel="${b.dataset.panel}"][data-mode="${b.dataset.mode}"]`, root)?.focus();
  });
}
