const API_BASE = localStorage.getItem("api_base") || "http://localhost:8080";

const state = {
  token: localStorage.getItem("token") || "",
  user: JSON.parse(localStorage.getItem("user") || "null"),
  boards: [],
  board: null,
  users: [],
};

const el = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers["Authorization"] = "Bearer " + state.token;
  const res = await fetch(API_BASE + path, { ...options, headers });
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

function toast(message, ok = false) {
  const t = el("toast");
  t.textContent = message;
  t.className = "toast" + (ok ? " ok" : "");
  setTimeout(() => (t.className = "toast hidden"), 3200);
}

function openModal(html) {
  el("modal").innerHTML = html;
  el("modal-backdrop").classList.remove("hidden");
}
function closeModal() {
  el("modal-backdrop").classList.add("hidden");
  el("modal").innerHTML = "";
}
el("modal-backdrop").addEventListener("click", (e) => {
  if (e.target === el("modal-backdrop")) closeModal();
});

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
    enterApp();
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

el("new-board-btn").addEventListener("click", showNewBoardModal);
el("metrics-btn").addEventListener("click", showMetricsModal);
el("labels-btn").addEventListener("click", showLabelsModal);
el("board-select").addEventListener("change", (e) => loadBoard(Number(e.target.value)));

async function enterApp() {
  el("auth-view").classList.add("hidden");
  el("app-view").classList.remove("hidden");
  el("current-user").textContent = state.user ? state.user.name : "";
  await Promise.all([loadBoards(), loadUsers()]);
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
  const select = el("board-select");
  select.innerHTML = "";
  if (state.boards.length === 0) {
    el("board-area").innerHTML = '<div class="empty">No hay tableros todavía. Crea uno con “+ Tablero”.</div>';
    return;
  }
  for (const b of state.boards) {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = b.name;
    select.appendChild(opt);
  }
  const current = state.board ? state.board.id : state.boards[0].id;
  select.value = current;
  await loadBoard(Number(select.value));
}

async function loadBoard(id) {
  state.board = await api("/boards/" + id);
  renderBoard();
}

function userName(id) {
  const u = state.users.find((x) => x.id === id);
  return u ? u.name : "—";
}

function labelById(id) {
  return (state.board.labels || []).find((l) => l.id === id);
}

function renderBoard() {
  const area = el("board-area");
  area.innerHTML = "";
  const b = state.board;
  const columns = [...b.columns].sort((a, c) => a.position - c.position);

  for (const col of columns) {
    const cards = b.cards.filter((c) => c.column_id === col.id);
    const colEl = document.createElement("div");
    colEl.className = "column";

    const atLimit = col.wip_limit > 0 && cards.length >= col.wip_limit;
    const near = col.wip_limit > 0 && cards.length === col.wip_limit - 1;
    const badgeClass = atLimit ? "full" : near ? "near" : "";
    const limitText = col.wip_limit > 0 ? cards.length + "/" + col.wip_limit : cards.length + "/∞";

    colEl.innerHTML = `
      <div class="column-header">
        <h3>${escapeHtml(col.name)}</h3>
        <span class="wip-badge ${badgeClass}">${limitText}</span>
      </div>
      <div class="cards" data-column="${col.id}"></div>
      <button class="add-card-btn" data-column="${col.id}">+ Tarjeta</button>
    `;

    const cardsEl = colEl.querySelector(".cards");
    for (const card of cards.sort((a, c) => a.position - c.position || a.id - c.id)) {
      cardsEl.appendChild(renderCard(card));
    }
    setupDropZone(cardsEl, col);
    colEl.querySelector(".add-card-btn").addEventListener("click", () => showCardModal(col.id));
    area.appendChild(colEl);
  }

  const addCol = document.createElement("div");
  addCol.className = "add-column";
  addCol.innerHTML = "<button>+ Columna</button>";
  addCol.querySelector("button").addEventListener("click", showNewColumnModal);
  area.appendChild(addCol);
}

function renderCard(card) {
  const node = document.createElement("div");
  node.className = "card prio-" + card.priority;
  node.draggable = true;
  node.dataset.card = card.id;

  const labelsHtml = (card.label_ids || [])
    .map((id) => labelById(id))
    .filter(Boolean)
    .map((l) => `<span class="label-chip" style="background:${escapeAttr(l.color)}">${escapeHtml(l.name)}</span>`)
    .join("");

  node.innerHTML = `
    <div class="card-title">${escapeHtml(card.title)}</div>
    ${card.description ? `<div class="muted">${escapeHtml(card.description)}</div>` : ""}
    ${labelsHtml ? `<div class="card-labels">${labelsHtml}</div>` : ""}
    <div class="card-meta">
      <span class="assignee">${card.assignee_id ? "👤 " + escapeHtml(userName(card.assignee_id)) : ""}</span>
      <span class="muted">#${card.id}</span>
    </div>
  `;

  node.addEventListener("dragstart", (e) => {
    node.classList.add("dragging");
    e.dataTransfer.setData("text/plain", String(card.id));
  });
  node.addEventListener("dragend", () => node.classList.remove("dragging"));
  node.addEventListener("click", () => showCardModal(card.column_id, card));
  return node;
}

function setupDropZone(zone, col) {
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", async (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const cardId = Number(e.dataTransfer.getData("text/plain"));
    if (!cardId) return;
    try {
      await api("/cards/" + cardId + "/move", {
        method: "POST",
        body: JSON.stringify({ column_id: col.id }),
      });
      await loadBoard(state.board.id);
    } catch (err) {
      if (err.code === "wip_limit_reached") {
        toast("🚫 " + err.message);
      } else {
        toast(err.message);
      }
    }
  });
}

function showNewBoardModal() {
  openModal(`
    <h2>Nuevo tablero</h2>
    <form id="board-form">
      <label>Nombre<input type="text" id="b-name" required /></label>
      <label>Descripción<textarea id="b-desc" rows="2"></textarea></label>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="closeModalGlobal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Crear</button>
      </div>
    </form>
  `);
  el("board-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const b = await api("/boards", {
        method: "POST",
        body: JSON.stringify({ name: el("b-name").value.trim(), description: el("b-desc").value.trim() }),
      });
      closeModal();
      state.board = { id: b.id };
      await loadBoards();
      toast("Tablero creado", true);
    } catch (err) {
      toast(err.message);
    }
  });
}

function showNewColumnModal() {
  openModal(`
    <h2>Nueva columna</h2>
    <form id="col-form">
      <label>Nombre<input type="text" id="c-name" required placeholder="En progreso" /></label>
      <label>Posición<input type="number" id="c-pos" value="${state.board.columns.length}" min="0" /></label>
      <label>Límite de WIP (0 = sin límite)<input type="number" id="c-wip" value="0" min="0" /></label>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="closeModalGlobal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Crear</button>
      </div>
    </form>
  `);
  el("col-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/boards/" + state.board.id + "/columns", {
        method: "POST",
        body: JSON.stringify({
          name: el("c-name").value.trim(),
          position: Number(el("c-pos").value),
          wip_limit: Number(el("c-wip").value),
        }),
      });
      closeModal();
      await loadBoard(state.board.id);
    } catch (err) {
      toast(err.message);
    }
  });
}

function showCardModal(columnId, card = null) {
  const editing = !!card;
  const labels = state.board.labels || [];
  const assigneeOptions = ['<option value="">Sin asignar</option>']
    .concat(
      state.users.map(
        (u) => `<option value="${u.id}" ${card && card.assignee_id === u.id ? "selected" : ""}>${escapeHtml(u.name)}</option>`
      )
    )
    .join("");
  const labelChecks = labels
    .map(
      (l) => `
    <label class="checkbox-row">
      <input type="checkbox" value="${l.id}" ${card && (card.label_ids || []).includes(l.id) ? "checked" : ""} />
      <span class="label-chip" style="background:${escapeAttr(l.color)}">${escapeHtml(l.name)}</span>
    </label>`
    )
    .join("");

  openModal(`
    <h2>${editing ? "Editar tarjeta" : "Nueva tarjeta"}</h2>
    <form id="card-form">
      <label>Título<input type="text" id="k-title" required value="${editing ? escapeAttr(card.title) : ""}" /></label>
      <label>Descripción<textarea id="k-desc" rows="2">${editing ? escapeHtml(card.description) : ""}</textarea></label>
      <label>Prioridad
        <select id="k-prio">
          <option value="low" ${card && card.priority === "low" ? "selected" : ""}>Baja</option>
          <option value="medium" ${!card || card.priority === "medium" ? "selected" : ""}>Media</option>
          <option value="high" ${card && card.priority === "high" ? "selected" : ""}>Alta</option>
        </select>
      </label>
      <label>Asignar a<select id="k-assignee">${assigneeOptions}</select></label>
      ${labels.length ? `<div><span class="muted">Etiquetas</span>${labelChecks}</div>` : ""}
      <div class="modal-actions">
        ${editing ? '<button type="button" class="btn btn-danger" id="k-delete">Eliminar</button>' : "<span></span>"}
        <div style="display:flex;gap:.5rem">
          <button type="button" class="btn" onclick="closeModalGlobal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">${editing ? "Guardar" : "Crear"}</button>
        </div>
      </div>
    </form>
  `);

  el("card-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const assigneeVal = el("k-assignee").value;
    const labelIds = Array.from(el("card-form").querySelectorAll('input[type="checkbox"]:checked')).map((c) =>
      Number(c.value)
    );
    const body = {
      title: el("k-title").value.trim(),
      description: el("k-desc").value.trim(),
      priority: el("k-prio").value,
      assignee_id: assigneeVal ? Number(assigneeVal) : null,
      label_ids: labelIds,
    };
    try {
      if (editing) {
        await api("/cards/" + card.id, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await api("/columns/" + columnId + "/cards", { method: "POST", body: JSON.stringify(body) });
      }
      closeModal();
      await loadBoard(state.board.id);
    } catch (err) {
      toast(err.message);
    }
  });

  if (editing) {
    el("k-delete").addEventListener("click", async () => {
      if (!confirm("¿Eliminar esta tarjeta?")) return;
      try {
        await api("/cards/" + card.id, { method: "DELETE" });
        closeModal();
        await loadBoard(state.board.id);
      } catch (err) {
        toast(err.message);
      }
    });
  }
}

async function showMetricsModal() {
  openModal('<h2>Métricas</h2><p class="muted">Cargando…</p>');
  try {
    const m = await api("/boards/" + state.board.id + "/metrics");
    const rows = m.columns
      .map(
        (c) =>
          `<div class="metric-row"><span>${escapeHtml(c.name)}</span><span class="${c.over_limit ? "over" : ""}">${
            c.card_count
          }${c.wip_limit > 0 ? " / " + c.wip_limit : ""}</span></div>`
      )
      .join("");
    const ct = m.cycle_time;
    openModal(`
      <h2>Métricas del tablero</h2>
      <div class="metrics-grid">
        <div class="stat"><div class="value">${m.total_cards}</div><div class="label">Tarjetas totales</div></div>
        <div class="stat"><div class="value">${ct.completed_cards}</div><div class="label">Completadas</div></div>
        <div class="stat"><div class="value">${ct.avg_hours}</div><div class="label">Cycle time prom. (h)</div></div>
      </div>
      <h3 style="font-size:1rem">WIP por columna</h3>
      ${rows}
      ${
        ct.completed_cards > 0
          ? `<p class="muted" style="margin-top:1rem">Cycle time — mín: ${ct.min_hours}h · máx: ${ct.max_hours}h</p>`
          : '<p class="muted" style="margin-top:1rem">Aún no hay tarjetas que hayan llegado a “Hecho”.</p>'
      }
      <div class="modal-actions"><span></span><button class="btn btn-primary" onclick="closeModalGlobal()">Cerrar</button></div>
    `);
  } catch (err) {
    toast(err.message);
    closeModal();
  }
}

function showLabelsModal() {
  const labels = state.board.labels || [];
  const list = labels.length
    ? labels
        .map(
          (l) => `<div class="row">
            <span class="label-chip" style="background:${escapeAttr(l.color)}">${escapeHtml(l.name)}</span>
            <button class="btn btn-sm btn-danger" data-label="${l.id}">Borrar</button>
          </div>`
        )
        .join("")
    : '<p class="muted">Sin etiquetas.</p>';

  openModal(`
    <h2>Etiquetas</h2>
    <div class="labels-list">${list}</div>
    <form id="label-form">
      <label>Nombre<input type="text" id="l-name" required placeholder="Bug" /></label>
      <label>Color<input type="color" id="l-color" value="#e74c3c" /></label>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="closeModalGlobal()">Cerrar</button>
        <button type="submit" class="btn btn-primary">Agregar</button>
      </div>
    </form>
  `);

  el("label-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/boards/" + state.board.id + "/labels", {
        method: "POST",
        body: JSON.stringify({ name: el("l-name").value.trim(), color: el("l-color").value }),
      });
      await loadBoard(state.board.id);
      showLabelsModal();
    } catch (err) {
      toast(err.message);
    }
  });

  el("modal").querySelectorAll("[data-label]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api("/labels/" + btn.dataset.label, { method: "DELETE" });
        await loadBoard(state.board.id);
        showLabelsModal();
      } catch (err) {
        toast(err.message);
      }
    });
  });
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
function escapeAttr(s) {
  return escapeHtml(s);
}
window.closeModalGlobal = closeModal;

if (state.token) {
  enterApp().catch(() => {
    state.token = "";
    localStorage.removeItem("token");
  });
} else {
  setAuthMode("login");
}
