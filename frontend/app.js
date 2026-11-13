const API = localStorage.getItem("api_base") || "";

const state = {
  token: localStorage.getItem("token") || "",
  user: JSON.parse(localStorage.getItem("user") || "null"),
  boards: [],
  boardId: null,
  board: null,
  users: [],
  view: "board",
};

const el = (id) => document.getElementById(id);
const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const initials = (name) =>
  (name || "·")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase() || "·";

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers["Authorization"] = "Bearer " + state.token;
  const res = await fetch(API + path, { ...options, headers });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Error " + res.status);
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

let toastTimer;
function toast(message, kind = "err") {
  const t = el("toast");
  const ico = kind === "ok" ? "✓" : kind === "err" ? "✕" : "ℹ";
  t.className = "toast show " + kind;
  t.innerHTML = `<span class="toast-ico">${ico}</span><span>${esc(message)}</span>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast " + kind), 3400);
}

const modalRoot = el("modal-root");
function openModal(html) {
  el("modal").innerHTML = html;
  modalRoot.classList.remove("hidden");
}
function closeModal() {
  modalRoot.classList.add("hidden");
  el("modal").innerHTML = "";
}
modalRoot.querySelector(".modal-backdrop").addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});
window.closeModal = closeModal;

let authMode = "login";
function setAuthMode(mode) {
  authMode = mode;
  el("tab-login").classList.toggle("active", mode === "login");
  el("tab-register").classList.toggle("active", mode === "register");
  el("name-field").classList.toggle("hidden", mode === "login");
  el("auth-submit").textContent = mode === "login" ? "Entrar" : "Crear cuenta";
  el("auth-error").textContent = "";
}
el("tab-login").addEventListener("click", () => setAuthMode("login"));
el("tab-register").addEventListener("click", () => setAuthMode("register"));

el("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  el("auth-error").textContent = "";
  const email = el("auth-email").value.trim();
  const password = el("auth-password").value;
  const name = el("auth-name").value.trim();
  try {
    const path = authMode === "login" ? "/auth/login" : "/auth/register";
    const body = authMode === "login" ? { email, password } : { name, email, password };
    const data = await api(path, { method: "POST", body: JSON.stringify(body) });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("token", state.token);
    localStorage.setItem("user", JSON.stringify(state.user));
    await enterApp();
  } catch (err) {
    el("auth-error").textContent = err.message;
  }
});

el("logout-btn").addEventListener("click", () => {
  state.token = "";
  state.user = null;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  el("app-view").classList.add("hidden");
  el("auth-view").classList.remove("hidden");
});

el("new-board-btn").addEventListener("click", showBoardModal);
el("new-column-btn").addEventListener("click", showColumnModal);
el("labels-btn").addEventListener("click", showLabelsModal);
el("view-switch").querySelectorAll(".seg").forEach((b) =>
  b.addEventListener("click", () => switchView(b.dataset.view))
);

async function enterApp() {
  el("auth-view").classList.add("hidden");
  el("app-view").classList.remove("hidden");
  el("current-user").textContent = state.user ? state.user.name : "";
  el("user-avatar").textContent = initials(state.user ? state.user.name : "");
  await loadUsers();
  await loadBoards();
}

async function loadUsers() {
  try {
    state.users = await api("/users");
  } catch {
    state.users = [];
  }
}

async function loadBoards() {
  state.boards = (await api("/boards")) || [];
  renderSidebar();
  if (state.boards.length === 0) {
    state.board = null;
    state.boardId = null;
    el("board-title").textContent = "Sin tableros";
    el("board-desc").textContent = "Crea tu primer tablero para empezar.";
    el("board-view").innerHTML = `<div class="empty-state"><div class="big">◧</div>Crea un tablero con el botón <b>+</b> de la izquierda.</div>`;
    return;
  }
  const target = state.boards.some((b) => b.id === state.boardId) ? state.boardId : state.boards[0].id;
  await selectBoard(target);
}

function renderSidebar() {
  const nav = el("board-nav");
  nav.innerHTML = "";
  for (const b of state.boards) {
    const item = document.createElement("div");
    item.className = "board-nav-item" + (b.id === state.boardId ? " active" : "");
    item.innerHTML = `<span class="dot"></span><span>${esc(b.name)}</span>`;
    item.addEventListener("click", () => selectBoard(b.id));
    nav.appendChild(item);
  }
}

async function selectBoard(id) {
  state.boardId = id;
  state.board = await api("/boards/" + id);
  el("board-title").textContent = state.board.name;
  el("board-desc").textContent = state.board.description || "";
  renderSidebar();
  render();
}

function switchView(v) {
  state.view = v;
  el("view-switch").querySelectorAll(".seg").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  el("new-column-btn").classList.toggle("hidden", v !== "board");
  render();
}

function render() {
  const boardView = el("board-view");
  const metricsView = el("metrics-view");
  if (state.view === "board") {
    boardView.classList.remove("hidden");
    metricsView.classList.add("hidden");
    renderBoard();
  } else {
    boardView.classList.add("hidden");
    metricsView.classList.remove("hidden");
    renderMetrics();
  }
}

function userName(id) {
  const u = state.users.find((x) => x.id === id);
  return u ? u.name : "?";
}
function labelById(id) {
  return (state.board.labels || []).find((l) => l.id === id);
}
function cardsIn(colId) {
  return state.board.cards.filter((c) => c.column_id === colId);
}

function renderBoard() {
  const area = el("board-view");
  area.innerHTML = "";
  const columns = [...state.board.columns].sort((a, b) => a.position - b.position);

  for (const col of columns) {
    const cards = cardsIn(col.id);
    const n = cards.length;
    const lim = col.wip_limit;
    const full = lim > 0 && n >= lim;
    const near = lim > 0 && n === lim - 1;
    const stateCls = full ? "full" : near ? "near" : "";

    const colEl = document.createElement("div");
    colEl.className = "column";
    colEl.innerHTML = `
      <div class="column-head">
        <h3>${esc(col.name)}</h3>
        <span class="wip-badge ${stateCls}">${lim > 0 ? n + "/" + lim : n}</span>
      </div>
      <div class="wip-bar ${stateCls}"><i style="width:${lim > 0 ? Math.min(100, (n / lim) * 100) : 0}%"></i></div>
      <div class="cards" data-col="${col.id}"></div>
      <div class="add-card"><button data-col="${col.id}">+ Tarjeta</button></div>
    `;

    const cardsEl = colEl.querySelector(".cards");
    for (const card of cards.sort((a, b) => a.position - b.position || a.id - b.id)) {
      cardsEl.appendChild(renderCard(card));
    }
    setupDropZone(cardsEl, col);
    colEl.querySelector(".add-card button").addEventListener("click", () => showCardModal(col.id));
    area.appendChild(colEl);
  }

  const add = document.createElement("div");
  add.className = "add-column";
  add.innerHTML = "<button>+ Columna</button>";
  add.querySelector("button").addEventListener("click", showColumnModal);
  area.appendChild(add);
}

function renderCard(card) {
  const node = document.createElement("div");
  node.className = "card prio-" + card.priority;
  node.draggable = true;
  node.dataset.card = card.id;

  const labels = (card.label_ids || [])
    .map(labelById)
    .filter(Boolean)
    .map((l) => `<span class="chip" style="background:${esc(l.color)}">${esc(l.name)}</span>`)
    .join("");

  node.innerHTML = `
    <div class="card-title">${esc(card.title)}</div>
    ${card.description ? `<div class="card-desc">${esc(card.description)}</div>` : ""}
    ${labels ? `<div class="card-labels">${labels}</div>` : ""}
    <div class="card-foot">
      ${card.assignee_id ? `<span class="mini-avatar" title="${esc(userName(card.assignee_id))}">${esc(initials(userName(card.assignee_id)))}</span>` : "<span></span>"}
      <span class="card-id">#${card.id}</span>
    </div>
  `;

  node.addEventListener("dragstart", (e) => {
    node.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ id: card.id, from: card.column_id }));
  });
  node.addEventListener("dragend", () => node.classList.remove("dragging"));
  node.addEventListener("click", () => showCardModal(card.column_id, card));
  return node;
}

function setupDropZone(zone, col) {
  const willBlock = (fromCol) => col.wip_limit > 0 && cardsIn(col.id).length >= col.wip_limit && fromCol !== col.id;
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = document.querySelector(".card.dragging");
    const fromCol = dragging ? Number(dragging.closest(".cards").dataset.col) : 0;
    zone.classList.toggle("drop-block", willBlock(fromCol));
    zone.classList.toggle("drop-ok", !willBlock(fromCol));
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drop-ok", "drop-block"));
  zone.addEventListener("drop", async (e) => {
    e.preventDefault();
    zone.classList.remove("drop-ok", "drop-block");
    let payload;
    try {
      payload = JSON.parse(e.dataTransfer.getData("text/plain"));
    } catch {
      return;
    }
    if (!payload || payload.from === col.id) return;
    try {
      await api("/cards/" + payload.id + "/move", { method: "POST", body: JSON.stringify({ column_id: col.id }) });
      state.board = await api("/boards/" + state.boardId);
      renderBoard();
    } catch (err) {
      if (err.code === "wip_limit_reached") toast("Columna llena: " + col.name + " alcanzó su límite de WIP", "err");
      else toast(err.message, "err");
    }
  });
}

async function renderMetrics() {
  const view = el("metrics-view");
  view.innerHTML = `<div class="metrics-empty">Cargando métricas…</div>`;
  let m;
  try {
    m = await api("/boards/" + state.boardId + "/metrics");
  } catch (err) {
    view.innerHTML = `<div class="metrics-empty">No se pudieron cargar las métricas: ${esc(err.message)}</div>`;
    return;
  }

  const inFlight = m.columns.reduce((s, c) => s + (c.wip_limit > 0 ? c.card_count : 0), 0);
  const ct = m.cycle_time;

  const wipMax = Math.max(1, ...m.columns.map((c) => Math.max(c.card_count, c.wip_limit)));
  const wipBars = m.columns
    .map((c) => {
      const w = (c.card_count / wipMax) * 100;
      const limitPos = c.wip_limit > 0 ? (c.wip_limit / wipMax) * 100 : null;
      const valTxt = c.wip_limit > 0 ? `${c.card_count}/${c.wip_limit}` : `${c.card_count}`;
      return `
      <div class="bar-row" title="${esc(c.name)} — ${valTxt}${c.over_limit ? " (sobre el límite)" : ""}">
        <div class="bar-name">${esc(c.name)}</div>
        <div class="bar-track">
          <div class="bar-fill ${c.over_limit ? "over" : ""}" style="width:${w}%"></div>
          ${limitPos != null ? `<div class="bar-limit" style="left:${limitPos}%"></div>` : ""}
        </div>
        <div class="bar-val">${c.over_limit ? '<span class="over">⚠ </span>' : ""}<span class="${c.over_limit ? "over" : ""}">${valTxt}</span></div>
      </div>`;
    })
    .join("");

  let cyclePanel;
  if (ct.completed_cards === 0) {
    cyclePanel = `<p class="metrics-empty">Aún no hay tarjetas que hayan llegado a “Hecho”. En cuanto una tarjeta pase por “En progreso” hasta “Hecho”, aquí verás su cycle time.</p>`;
  } else {
    const cMax = Math.max(1, ...ct.per_card.map((p) => p.hours), ct.avg_hours);
    const cycleBars = ct.per_card
      .map((p) => {
        const title = state.board.cards.find((c) => c.id === p.card_id);
        const name = title ? title.title : "#" + p.card_id;
        return `
        <div class="bar-row" title="${esc(name)} — ${p.hours} h">
          <div class="bar-name">${esc(name)}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${(p.hours / cMax) * 100}%"></div>
            <div class="bar-limit" style="left:${(ct.avg_hours / cMax) * 100}%; background:var(--accent); opacity:1;"></div>
          </div>
          <div class="bar-val">${p.hours} h</div>
        </div>`;
      })
      .join("");
    cyclePanel = `
      ${cycleBars}
      <div class="legend">
        <span><i style="background:var(--viz)"></i> Horas por tarjeta</span>
        <span><i class="ln" style="background:var(--accent);opacity:1"></i> Promedio (${ct.avg_hours} h)</span>
      </div>`;
  }

  view.innerHTML = `
    <div class="stat-row">
      ${stat("Tarjetas totales", m.total_cards, "En el tablero", "▦")}
      ${stat("En curso (WIP)", inFlight, "Columnas con límite", "◱")}
      ${stat("Completadas", ct.completed_cards, "Llegaron a Hecho", "✓")}
      ${stat("Cycle time prom.", ct.completed_cards ? ct.avg_hours + " h" : "—", ct.completed_cards ? `mín ${ct.min_hours}h · máx ${ct.max_hours}h` : "sin datos", "◷")}
    </div>
    <div class="panels">
      <div class="panel">
        <h3>WIP por columna</h3>
        <p class="panel-sub">Tarjetas actuales frente al límite de cada etapa.</p>
        ${wipBars}
        <div class="legend">
          <span><i style="background:var(--viz)"></i> Tarjetas</span>
          <span><i style="background:var(--critical)"></i> Sobre el límite</span>
          <span><i class="ln"></i> Límite de WIP</span>
        </div>
      </div>
      <div class="panel">
        <h3>Cycle time por tarjeta</h3>
        <p class="panel-sub">Tiempo de “En progreso” a “Hecho”.</p>
        ${cyclePanel}
      </div>
    </div>
  `;
}

function stat(label, value, sub, ico) {
  return `
  <div class="stat">
    <div class="stat-ico">${ico}</div>
    <div class="stat-label">${esc(label)}</div>
    <div class="stat-value">${esc(value)}</div>
    <div class="stat-sub">${esc(sub)}</div>
  </div>`;
}

function showBoardModal() {
  openModal(`
    <h2>Nuevo tablero</h2>
    <form id="f" class="form">
      <label class="field"><span>Nombre</span><input id="n" required placeholder="Proyecto X" /></label>
      <label class="field"><span>Descripción</span><textarea id="d" placeholder="Opcional"></textarea></label>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-primary">Crear tablero</button></div>
    </form>`);
  el("f").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const b = await api("/boards", { method: "POST", body: JSON.stringify({ name: el("n").value.trim(), description: el("d").value.trim() }) });
      closeModal();
      state.boardId = b.id;
      await loadBoards();
      toast("Tablero creado", "ok");
    } catch (err) {
      toast(err.message, "err");
    }
  });
}

function showColumnModal() {
  if (!state.board) return;
  openModal(`
    <h2>Nueva columna</h2>
    <form id="f" class="form">
      <label class="field"><span>Nombre</span><input id="n" required placeholder="En progreso" /></label>
      <div class="row-2">
        <label class="field"><span>Posición</span><input id="p" type="number" min="0" value="${state.board.columns.length}" /></label>
        <label class="field"><span>Límite WIP (0 = ∞)</span><input id="w" type="number" min="0" value="0" /></label>
      </div>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-primary">Crear columna</button></div>
    </form>`);
  el("f").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/boards/" + state.boardId + "/columns", {
        method: "POST",
        body: JSON.stringify({ name: el("n").value.trim(), position: Number(el("p").value), wip_limit: Number(el("w").value) }),
      });
      closeModal();
      await selectBoard(state.boardId);
    } catch (err) {
      toast(err.message, "err");
    }
  });
}

function showCardModal(columnId, card = null) {
  const editing = !!card;
  const labels = state.board.labels || [];
  const opts = ['<option value="">Sin asignar</option>']
    .concat(state.users.map((u) => `<option value="${u.id}" ${card && card.assignee_id === u.id ? "selected" : ""}>${esc(u.name)}</option>`))
    .join("");
  const checks = labels
    .map(
      (l) => `<label class="check-row"><input type="checkbox" value="${l.id}" ${card && (card.label_ids || []).includes(l.id) ? "checked" : ""} /><span class="chip" style="background:${esc(l.color)}">${esc(l.name)}</span></label>`
    )
    .join("");

  openModal(`
    <h2>${editing ? "Editar tarjeta" : "Nueva tarjeta"}</h2>
    <form id="f" class="form">
      <label class="field"><span>Título</span><input id="t" required value="${editing ? esc(card.title) : ""}" placeholder="¿Qué hay que hacer?" /></label>
      <label class="field"><span>Descripción</span><textarea id="d">${editing ? esc(card.description) : ""}</textarea></label>
      <div class="row-2">
        <label class="field"><span>Prioridad</span><select id="p">
          <option value="low" ${card && card.priority === "low" ? "selected" : ""}>Baja</option>
          <option value="medium" ${!card || card.priority === "medium" ? "selected" : ""}>Media</option>
          <option value="high" ${card && card.priority === "high" ? "selected" : ""}>Alta</option>
        </select></label>
        <label class="field"><span>Asignar a</span><select id="a">${opts}</select></label>
      </div>
      ${labels.length ? `<div class="field"><span>Etiquetas</span><div class="check-list">${checks}</div></div>` : ""}
      <div class="modal-actions">
        ${editing ? '<button type="button" class="btn btn-danger" id="del">Eliminar</button>' : '<span class="spacer"></span>'}
        <span class="spacer"></span>
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary">${editing ? "Guardar" : "Crear"}</button>
      </div>
    </form>`);

  el("f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const a = el("a").value;
    const labelIds = Array.from(el("f").querySelectorAll('input[type="checkbox"]:checked')).map((c) => Number(c.value));
    const body = {
      title: el("t").value.trim(),
      description: el("d").value.trim(),
      priority: el("p").value,
      assignee_id: a ? Number(a) : null,
      label_ids: labelIds,
    };
    try {
      if (editing) await api("/cards/" + card.id, { method: "PUT", body: JSON.stringify(body) });
      else await api("/columns/" + columnId + "/cards", { method: "POST", body: JSON.stringify(body) });
      closeModal();
      await selectBoard(state.boardId);
    } catch (err) {
      toast(err.message, "err");
    }
  });

  if (editing)
    el("del").addEventListener("click", async () => {
      if (!confirm("¿Eliminar esta tarjeta?")) return;
      try {
        await api("/cards/" + card.id, { method: "DELETE" });
        closeModal();
        await selectBoard(state.boardId);
      } catch (err) {
        toast(err.message, "err");
      }
    });
}

function showLabelsModal() {
  if (!state.board) return;
  const labels = state.board.labels || [];
  const list = labels.length
    ? labels
        .map((l) => `<div class="lm-row"><span class="chip" style="background:${esc(l.color)}">${esc(l.name)}</span><button class="btn btn-sm btn-danger" data-label="${l.id}">Borrar</button></div>`)
        .join("")
    : '<p class="muted sm">Sin etiquetas todavía.</p>';

  openModal(`
    <h2>Etiquetas</h2>
    <div class="labels-manage">${list}</div>
    <form id="f" class="form">
      <div class="row-2">
        <label class="field"><span>Nombre</span><input id="n" required placeholder="Bug" /></label>
        <label class="field"><span>Color</span><input id="c" type="color" value="#6366f1" /></label>
      </div>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeModal()">Cerrar</button><button class="btn btn-primary">Agregar etiqueta</button></div>
    </form>`);

  el("f").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/boards/" + state.boardId + "/labels", { method: "POST", body: JSON.stringify({ name: el("n").value.trim(), color: el("c").value }) });
      await selectBoard(state.boardId);
      showLabelsModal();
    } catch (err) {
      toast(err.message, "err");
    }
  });
  el("modal")
    .querySelectorAll("[data-label]")
    .forEach((btn) =>
      btn.addEventListener("click", async () => {
        try {
          await api("/labels/" + btn.dataset.label, { method: "DELETE" });
          await selectBoard(state.boardId);
          showLabelsModal();
        } catch (err) {
          toast(err.message, "err");
        }
      })
    );
}

if (state.token) {
  enterApp().catch(() => {
    state.token = "";
    localStorage.removeItem("token");
    el("app-view").classList.add("hidden");
    el("auth-view").classList.remove("hidden");
    setAuthMode("login");
  });
} else {
  setAuthMode("login");
}
