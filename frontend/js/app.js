import { api, session } from "./api.js";
import { $, $$, html, icon, initials, debounce } from "./lib.js";
import { store, wipState, sortedColumns, cardsIn } from "./store.js";
import { setupMenu, theme, toast } from "./ui.js";
import { renderBoard, matchesFilter } from "./board.js";
import { renderMetrics } from "./metrics.js";
import { boardDialog, deleteBoardFlow, columnDialog, labelsDialog } from "./dialogs.js";

let bound = false;

export async function enterApp(user) {
  store.user = user;
  $("#auth").hidden = true;
  $("#app").hidden = false;
  bindOnce();
  renderAccount();
  $("#board-view").innerHTML = html`<div class="columns">${[1, 2, 3].map(() => html`<div class="column skeleton-column"><i></i><i></i><i></i></div>`)}</div>`;
  const [users] = await Promise.all([api.users().catch(() => []), refreshBoards(null)]);
  store.users = users || [];
  rerender();
}

export function leaveApp() {
  Object.assign(store, { user: null, users: [], boards: [], boardId: null, board: null, filter: "" });
  $("#filter").value = "";
}

export async function refreshBoards(preferId) {
  store.boards = (await api.boards()) || [];
  const keep = [preferId, store.boardId].find((id) => id && store.boards.some((b) => b.id === id));
  const id = keep || store.boards[0]?.id || null;
  renderSidebar();
  if (id) await selectBoard(id);
  else {
    store.boardId = null;
    store.board = null;
    rerender();
  }
}

export async function selectBoard(id) {
  store.boardId = id;
  renderSidebar();
  closeSidebar();
  store.board = await api.board(id);
  rerender();
}

export async function refreshBoard() {
  if (!store.boardId) return;
  store.board = await api.board(store.boardId);
  const i = store.boards.findIndex((b) => b.id === store.boardId);
  if (i >= 0) store.boards[i] = { ...store.boards[i], name: store.board.name, description: store.board.description };
  rerender();
}

function rerender() {
  renderSidebar();
  renderHeader();
  renderSummary();
  const hasBoard = !!store.board;
  $("#board-tabs").hidden = !hasBoard;
  $("#board-view").hidden = hasBoard && store.view !== "board";
  $("#metrics-view").hidden = !hasBoard || store.view !== "metrics";

  if (!hasBoard) {
    $("#board-view").hidden = false;
    $("#board-view").innerHTML = html`
      <div class="empty">
        <div class="empty-art" aria-hidden="true"><i></i><i></i><i></i></div>
        <h2>Tu primer tablero</h2>
        <p>Un tablero agrupa el flujo de un proyecto: sus etapas, sus límites de WIP y las tarjetas que avanzan por ellas.</p>
        <div class="empty-actions"><button class="btn btn-primary" type="button" id="empty-new-board">${icon("plus")}Crear tablero</button></div>
      </div>`;
    $("#empty-new-board").addEventListener("click", () => boardDialog());
    return;
  }
  if (store.view === "board") renderBoard();
  else renderMetrics();
}

function renderSidebar() {
  const list = $("#board-list");
  list.innerHTML = store.boards.length
    ? html`${store.boards.map(
        (b) => html`
          <li>
            <button type="button" class="board-link" data-board="${b.id}" ${b.id === store.boardId ? html`aria-current="page"` : ""}>
              <span class="board-glyph" aria-hidden="true">${initials(b.name).slice(0, 1)}</span>
              <span class="board-link-name">${b.name}</span>
            </button>
          </li>`
      )}`
    : html`<li class="nav-empty">Aún no hay tableros</li>`;
}

function renderHeader() {
  const b = store.board;
  $("#board-title").textContent = b ? b.name : "Tableros";
  $("#board-desc").textContent = b ? b.description || "" : "";
  $("#board-desc").hidden = !b?.description;
  $$("[data-requires-board]").forEach((el) => (el.hidden = !b));
  $("#new-column-btn").hidden = !b || store.view !== "board";
  $("#filter-wrap").hidden = !b || store.view !== "board";
  document.title = b ? `${b.name} · Kanban` : "Kanban";
  $$('[role="tab"]').forEach((t) => {
    const active = t.dataset.view === store.view;
    t.setAttribute("aria-selected", String(active));
    t.tabIndex = active ? 0 : -1;
  });
}

export function renderSummary() {
  const el = $("#board-summary");
  const b = store.board;
  if (!b) return (el.innerHTML = "");
  const total = b.cards.length;
  const visible = b.cards.filter(matchesFilter).length;
  const atLimit = sortedColumns().filter((c) => ["full", "over"].includes(wipState(c, cardsIn(c.id).length))).length;
  el.innerHTML = html`
    ${store.filter && store.view === "board"
      ? html`<span>${visible} de ${total} ${total === 1 ? "tarjeta" : "tarjetas"}</span>`
      : html`<span>${total} ${total === 1 ? "tarjeta" : "tarjetas"}</span>`}
    <span class="dot-sep" aria-hidden="true"></span>
    <span>${b.columns.length} ${b.columns.length === 1 ? "columna" : "columnas"}</span>
    ${atLimit ? html`<span class="dot-sep" aria-hidden="true"></span><span class="summary-flag">${icon("lock")}${atLimit} en su límite</span>` : ""}`;
}

function renderAccount() {
  const u = store.user || {};
  $("#account-avatar").textContent = initials(u.name);
  $("#account-name").textContent = u.name || "";
  $("#account-email").textContent = u.email || "";
  syncThemeRadios();
}

function syncThemeRadios() {
  const current = theme.get();
  $$("[data-theme-option]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.themeOption === current)));
}

function switchView(view) {
  if (store.view === view) return;
  store.view = view;
  rerender();
}

function openSidebar() {
  $("#app").classList.add("sidebar-open");
  $("#scrim").hidden = false;
  ($("#board-list [aria-current]") || $("#board-list button") || $("#new-board"))?.focus();
}
function closeSidebar() {
  $("#app").classList.remove("sidebar-open");
  $("#scrim").hidden = true;
}

function bindOnce() {
  if (bound) return;
  bound = true;

  $("#board-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-board]");
    if (btn) selectBoard(Number(btn.dataset.board)).catch((err) => toast(err.message, "error"));
  });
  $("#new-board").addEventListener("click", () => boardDialog());
  $("#new-column-btn").addEventListener("click", () => columnDialog());
  $("#labels-btn").addEventListener("click", () => labelsDialog());
  $("#edit-board").addEventListener("click", () => boardDialog(store.board));
  $("#delete-board").addEventListener("click", () => deleteBoardFlow());
  $("#open-sidebar").addEventListener("click", openSidebar);
  $("#close-sidebar").addEventListener("click", closeSidebar);
  $("#scrim").addEventListener("click", closeSidebar);

  const tabs = $$('[role="tab"]');
  tabs.forEach((t) => {
    t.addEventListener("click", () => switchView(t.dataset.view));
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = tabs[(tabs.indexOf(t) + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      switchView(next.dataset.view);
    });
  });

  const applyFilter = debounce(() => {
    renderBoard();
    renderSummary();
  }, 120);
  $("#filter").addEventListener("input", (e) => {
    store.filter = e.target.value;
    applyFilter();
  });
  $("#filter").addEventListener("keydown", (e) => {
    if (e.key === "Escape" && e.target.value) {
      e.stopPropagation();
      e.target.value = "";
      store.filter = "";
      applyFilter();
    }
  });

  document.addEventListener("keydown", (e) => {
    if ($("#app").hidden || document.querySelector("dialog[open]")) return;
    const typing = e.target.closest?.("input, textarea, select, [contenteditable]");
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "/" && store.board && store.view === "board") {
      e.preventDefault();
      $("#filter").focus();
    }
    if (e.key === "Escape") closeSidebar();
  });

  setupMenu($("#account-menu"));
  setupMenu($("#board-menu"));

  $$("[data-theme-option]").forEach((b) =>
    b.addEventListener("click", () => {
      theme.set(b.dataset.themeOption);
      syncThemeRadios();
    })
  );
}
