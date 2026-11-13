import { api } from "./api.js";
import { $, $$, html, icon, safeColor } from "./lib.js";
import { store, sortedColumns, cardsIn, userById, labelById, columnById, wipState, PRIORITIES } from "./store.js";
import { toast, busy } from "./ui.js";
import { cardDialog, columnDialog, priorityGlyph, avatar } from "./dialogs.js";
import { refreshBoard, renderSummary } from "./app.js";

const STARTER_FLOW = [
  { name: "Backlog", wip_limit: 0 },
  { name: "Por hacer", wip_limit: 0 },
  { name: "En progreso", wip_limit: 3 },
  { name: "En pruebas", wip_limit: 2 },
  { name: "Hecho", wip_limit: 0 },
];

let dragging = null;
let bound = false;

export function matchesFilter(card) {
  const q = store.filter.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    card.title,
    card.description,
    userById(card.assignee_id)?.name,
    ...(card.label_ids || []).map((id) => labelById(id)?.name),
    `#${card.id}`,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((t) => hay.includes(t));
}

export function renderBoard() {
  const root = $("#board-view");
  bindOnce(root);
  const columns = sortedColumns();

  if (!columns.length) {
    root.innerHTML = html`
      <div class="empty">
        <div class="empty-art" aria-hidden="true"><i></i><i></i><i></i></div>
        <h2>Diseña el flujo de este proyecto</h2>
        <p>Las columnas son las etapas por las que pasa el trabajo. Empieza con el flujo recomendado o crea las tuyas.</p>
        <div class="empty-actions">
          <button class="btn btn-primary" type="button" data-action="starter">${icon("sparkle")}Usar flujo recomendado</button>
          <button class="btn" type="button" data-action="new-column">${icon("plus")}Columna en blanco</button>
        </div>
        <p class="empty-foot">Backlog → Por hacer → En progreso (WIP 3) → En pruebas (WIP 2) → Hecho</p>
      </div>`;
    return;
  }

  root.innerHTML = html`
    <div class="columns">
      ${columns.map(renderColumn)}
      <button class="add-column" type="button" data-action="new-column">${icon("plus")}<span>Agregar columna</span></button>
    </div>`;
}

function renderColumn(col) {
  const cards = cardsIn(col.id);
  const visible = cards.filter(matchesFilter);
  const n = cards.length;
  const state = wipState(col, n);
  const limited = col.wip_limit > 0;
  const pct = limited ? Math.min(100, (n / col.wip_limit) * 100) : 0;
  const status = {
    full: html`${icon("lock")}<span>Límite alcanzado: termina algo antes de traer más</span>`,
    over: html`${icon("alert")}<span>${n - col.wip_limit} sobre el límite</span>`,
  }[state];

  return html`
    <section class="column wip-${state}" data-col="${col.id}" aria-labelledby="col-${col.id}">
      <header class="column-head">
        <h2 id="col-${col.id}">${col.name}</h2>
        <span class="wip-count" data-tip="${limited ? `Límite de WIP: ${col.wip_limit}` : "Sin límite de WIP"}">
          <span class="sr-only">${limited ? `${n} de ${col.wip_limit} tarjetas` : `${n} tarjetas`}</span>
          <span aria-hidden="true">${n}${limited ? html`<span class="wip-of">/${col.wip_limit}</span>` : ""}</span>
        </span>
        <button class="icon-btn icon-btn-sm column-edit" type="button" data-action="edit-column" aria-label="Editar columna ${col.name}">${icon("settings")}</button>
      </header>
      ${limited ? html`<div class="wip-meter" aria-hidden="true"><i style="width:${pct}%"></i></div>` : html`<div class="wip-meter wip-meter-none" aria-hidden="true"></div>`}
      ${status ? html`<p class="wip-status">${status}</p>` : ""}
      <ol class="cards" data-drop="${col.id}" aria-label="Tarjetas en ${col.name}">
        ${visible.map((c) => html`<li>${renderCard(c)}</li>`)}
        ${n === 0 ? html`<li class="cards-empty">Suelta tarjetas aquí</li>` : ""}
        ${n > 0 && visible.length === 0 ? html`<li class="cards-empty">${n} ${n === 1 ? "tarjeta oculta" : "tarjetas ocultas"} por el filtro</li>` : ""}
      </ol>
      <button class="add-card" type="button" data-action="new-card">${icon("plus")}Agregar tarjeta</button>
    </section>`;
}

function renderCard(card) {
  const user = userById(card.assignee_id);
  const labels = (card.label_ids || []).map(labelById).filter(Boolean);
  const prio = PRIORITIES[card.priority] || PRIORITIES.medium;
  const a11y = [card.title, `prioridad ${prio.label.toLowerCase()}`, user ? `responsable ${user.name}` : "sin responsable"].join(", ");

  return html`
    <article class="card" tabindex="0" draggable="true" data-card="${card.id}" aria-label="${a11y}" aria-describedby="move-hint">
      ${labels.length
        ? html`<ul class="card-labels" aria-label="Etiquetas">
            ${labels.map((l) => html`<li class="label-chip"><i class="swatch" style="--swatch:${safeColor(l.color)}"></i>${l.name}</li>`)}
          </ul>`
        : ""}
      <h3 class="card-title">${card.title}</h3>
      ${card.description ? html`<p class="card-desc">${card.description}</p>` : ""}
      <footer class="card-foot">
        <span class="card-prio" data-tip="Prioridad ${prio.label.toLowerCase()}">${priorityGlyph(card.priority)}</span>
        <span class="card-id">#${card.id}</span>
        <span class="card-spacer"></span>
        ${avatar(user, "avatar-sm")}
      </footer>
    </article>`;
}

export async function moveCard(cardId, toColumnId, { focus = false } = {}) {
  const card = store.board.cards.find((c) => c.id === cardId);
  const target = columnById(toColumnId);
  if (!card || !target || card.column_id === toColumnId) return;

  if (target.wip_limit > 0 && cardsIn(toColumnId).length >= target.wip_limit) {
    rejectInto(toColumnId, target);
    return;
  }

  const from = card.column_id;
  card.column_id = toColumnId;
  renderBoard();
  renderSummary();
  if (focus) $(`[data-card="${cardId}"]`)?.focus();
  announce(`“${card.title}” movida a ${target.name}.`);

  try {
    await api.moveCard(cardId, toColumnId);
  } catch (err) {
    card.column_id = from;
    renderBoard();
    renderSummary();
    if (focus) $(`[data-card="${cardId}"]`)?.focus();
    if (err.code === "wip_limit_reached") rejectInto(toColumnId, target);
    else toast(err.message, "error", { title: "No se pudo mover la tarjeta" });
    refreshBoard().catch(() => {});
  }
}

function rejectInto(columnId, column) {
  const el = $(`.column[data-col="${columnId}"]`);
  if (el) {
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  }
  toast(`“${column.name}” ya tiene ${column.wip_limit} de ${column.wip_limit}. Termina algo antes de empezar más.`, "error", {
    title: "Límite de WIP alcanzado",
  });
}

const announce = (msg) => {
  const live = $("#sr-live");
  live.textContent = "";
  requestAnimationFrame(() => (live.textContent = msg));
};

function bindOnce(root) {
  if (bound) return;
  bound = true;

  root.addEventListener("click", async (e) => {
    const action = e.target.closest("[data-action]");
    const colId = Number(e.target.closest("[data-col]")?.dataset.col);
    if (action) {
      const a = action.dataset.action;
      if (a === "new-column") return columnDialog();
      if (a === "edit-column") return columnDialog(columnById(colId));
      if (a === "new-card") return cardDialog({ columnId: colId });
      if (a === "starter") return createStarterFlow(action);
    }
    const cardEl = e.target.closest("[data-card]");
    if (cardEl) openCard(Number(cardEl.dataset.card));
  });

  root.addEventListener("keydown", (e) => {
    const cardEl = e.target.closest?.("[data-card]");
    if (!cardEl || e.target !== cardEl) return;
    const id = Number(cardEl.dataset.card);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openCard(id);
    } else if (e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      e.preventDefault();
      const cols = sortedColumns();
      const card = store.board.cards.find((c) => c.id === id);
      const i = cols.findIndex((c) => c.id === card.column_id);
      const next = cols[i + (e.key === "ArrowRight" ? 1 : -1)];
      if (next) moveCard(id, next.id, { focus: true });
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const all = $$("[data-card]", cardEl.closest(".cards"));
      const i = all.indexOf(cardEl);
      all[i + (e.key === "ArrowDown" ? 1 : -1)]?.focus();
    }
  });

  root.addEventListener("dragstart", (e) => {
    const cardEl = e.target.closest?.("[data-card]");
    if (!cardEl) return;
    const id = Number(cardEl.dataset.card);
    dragging = { id, from: store.board.cards.find((c) => c.id === id)?.column_id, blockedOver: null };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
    requestAnimationFrame(() => cardEl.classList.add("is-dragging"));
    root.classList.add("is-dragging");
  });

  root.addEventListener("dragend", () => {
    const blocked = dragging?.blockedOver;
    if (blocked) rejectInto(blocked, columnById(blocked));
    dragging = null;
    root.classList.remove("is-dragging");
    $$(".is-dragging, .drop-ok, .drop-blocked", root).forEach((el) => el.classList.remove("is-dragging", "drop-ok", "drop-blocked"));
  });

  root.addEventListener("dragover", (e) => {
    const colEl = e.target.closest?.(".column");
    if (!dragging) return;
    if (!colEl) {
      dragging.blockedOver = null;
      return;
    }
    e.preventDefault();
    const col = columnById(Number(colEl.dataset.col));
    const blocked = col.id !== dragging.from && col.wip_limit > 0 && cardsIn(col.id).length >= col.wip_limit;
    dragging.blockedOver = blocked ? col.id : null;
    e.dataTransfer.dropEffect = blocked ? "none" : "move";
    $$(".drop-ok, .drop-blocked", root).forEach((el) => el !== colEl && el.classList.remove("drop-ok", "drop-blocked"));
    colEl.classList.toggle("drop-blocked", blocked);
    colEl.classList.toggle("drop-ok", !blocked && col.id !== dragging.from);
  });

  document.addEventListener("dragover", (e) => {
    if (dragging && !root.contains(e.target)) dragging.blockedOver = null;
  });

  root.addEventListener("drop", (e) => {
    const colEl = e.target.closest?.(".column");
    if (!colEl || !dragging) return;
    e.preventDefault();
    const { id } = dragging;
    colEl.classList.remove("drop-ok", "drop-blocked");
    moveCard(id, Number(colEl.dataset.col));
  });
}

function openCard(id) {
  const card = store.board.cards.find((c) => c.id === id);
  if (card) cardDialog({ card });
}

async function createStarterFlow(button) {
  await busy(button, async () => {
    try {
      for (const [i, c] of STARTER_FLOW.entries()) await api.createColumn(store.board.id, { ...c, position: i });
      await refreshBoard();
      toast("Flujo listo. Las métricas de cycle time usan “En progreso” → “Hecho”.", "success", { title: "Columnas creadas" });
    } catch (err) {
      toast(err.message, "error");
      await refreshBoard();
    }
  });
}
