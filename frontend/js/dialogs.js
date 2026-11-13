import { api } from "./api.js";
import { $, $$, html, icon, safeColor, initials } from "./lib.js";
import { store, sortedColumns, cardsIn, PRIORITIES } from "./store.js";
import { formDialog, confirmDialog, openDialog, toast, busy } from "./ui.js";
import { refreshBoard, refreshBoards } from "./app.js";

const rtf = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });
function relative(dateStr) {
  const diff = (new Date(dateStr) - Date.now()) / 1000;
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, secs] of units) if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  return "hace un momento";
}

const field = (label, control, hint) => html`
  <label class="field">
    <span class="field-label">${label}</span>
    ${control}
    ${hint ? html`<span class="field-hint">${hint}</span>` : ""}
  </label>`;

export function boardDialog(board = null) {
  formDialog({
    title: board ? "Editar tablero" : "Nuevo tablero",
    description: board ? null : "Un tablero representa un proyecto y su flujo de trabajo.",
    submitLabel: board ? "Guardar cambios" : "Crear tablero",
    body: html`
      ${field("Nombre", html`<input name="name" required maxlength="160" autocomplete="off" placeholder="p. ej. Lanzamiento v2" value="${board?.name || ""}" autofocus />`)}
      ${field("Descripción", html`<textarea name="description" rows="3" maxlength="1000" placeholder="¿De qué trata este proyecto? (opcional)">${board?.description || ""}</textarea>`)}`,
    async onSubmit(form) {
      const data = { name: form.name.value.trim(), description: form.description.value.trim() };
      if (board) {
        await api.updateBoard(board.id, data);
        await refreshBoards(board.id);
        toast("Tablero actualizado", "success");
      } else {
        const created = await api.createBoard(data);
        await refreshBoards(created.id);
        toast(`“${created.name}” está listo. Agrega su primera columna.`, "success", { title: "Tablero creado" });
      }
    },
  });
}

export async function deleteBoardFlow() {
  const b = store.board;
  if (!b) return;
  const ok = await confirmDialog({
    title: `¿Eliminar “${b.name}”?`,
    message: `Se borrarán ${b.columns.length} columnas, ${b.cards.length} tarjetas y su historial de métricas. No se puede deshacer.`,
    confirmLabel: "Eliminar tablero",
  });
  if (!ok) return;
  try {
    await api.deleteBoard(b.id);
    await refreshBoards(null);
    toast("Tablero eliminado", "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

export function columnDialog(column = null) {
  if (!store.board) return;
  const cols = sortedColumns();
  const count = column ? cardsIn(column.id).length : 0;
  const nextPos = cols.length ? Math.max(...cols.map((c) => c.position)) + 1 : 0;

  formDialog({
    title: column ? "Editar columna" : "Nueva columna",
    description: column ? null : "Cada columna es una etapa del flujo. El límite de WIP evita acumular trabajo a medias.",
    submitLabel: column ? "Guardar cambios" : "Crear columna",
    body: html`
      ${field("Nombre", html`<input name="name" required maxlength="120" autocomplete="off" placeholder="p. ej. En revisión" value="${column?.name || ""}" autofocus />`)}
      <div class="grid-2">
        ${field("Límite de WIP", html`<input name="wip" type="number" inputmode="numeric" min="0" max="999" step="1" value="${column?.wip_limit ?? 0}" />`, "0 = sin límite")}
        ${field("Orden", html`<input name="position" type="number" inputmode="numeric" min="0" step="1" value="${column?.position ?? nextPos}" />`, "De izquierda a derecha, menor primero")}
      </div>
      <p class="inline-note" data-wip-warning hidden>${icon("alert")}<span></span></p>`,
    onOpen(_dialog, form) {
      if (!column) return;
      const warn = $("[data-wip-warning]", form);
      const check = () => {
        const v = Number(form.wip.value);
        const over = v > 0 && count > v;
        warn.hidden = !over;
        if (over) $("span", warn).textContent = `La columna ya tiene ${count} tarjetas: quedará sobre el límite hasta que salgan ${count - v}.`;
      };
      form.wip.addEventListener("input", check);
    },
    async onSubmit(form) {
      const data = {
        name: form.name.value.trim(),
        wip_limit: Math.max(0, Math.floor(Number(form.wip.value) || 0)),
        position: Math.max(0, Math.floor(Number(form.position.value) || 0)),
      };
      if (column) await api.updateColumn(column.id, data);
      else await api.createColumn(store.board.id, data);
      await refreshBoard();
      toast(column ? "Columna actualizada" : `Columna “${data.name}” creada`, "success");
    },
  });
}

export function cardDialog({ columnId, card = null }) {
  if (!store.board) return;
  const editing = !!card;
  const currentCol = editing ? card.column_id : columnId;
  const labels = store.board.labels || [];

  const columnOptions = sortedColumns().map((c) => {
    const n = cardsIn(c.id).length;
    const full = c.wip_limit > 0 && n >= c.wip_limit && c.id !== currentCol;
    const meta = c.wip_limit > 0 ? ` · ${n}/${c.wip_limit}${full ? " (llena)" : ""}` : ` · ${n}`;
    return html`<option value="${c.id}" ${c.id === currentCol ? "selected" : ""} ${full ? "disabled" : ""}>${c.name}${meta}</option>`;
  });

  const priority = card?.priority || "medium";
  const priorityControl = html`
    <div class="segmented" role="radiogroup" aria-label="Prioridad">
      ${Object.entries(PRIORITIES)
        .reverse()
        .map(
          ([value, p]) => html`
            <label class="segmented-option">
              <input type="radio" name="priority" value="${value}" ${value === priority ? "checked" : ""} />
              <span>${priorityGlyph(value)}${p.label}</span>
            </label>`
        )}
    </div>`;

  const assignee = html`
    <select name="assignee">
      <option value="">Sin asignar</option>
      ${store.users.map((u) => html`<option value="${u.id}" ${card?.assignee_id === u.id ? "selected" : ""}>${u.name}</option>`)}
    </select>`;

  const labelPicker = labels.length
    ? html`<div class="label-picker">
        ${labels.map(
          (l) => html`
            <label class="label-toggle">
              <input type="checkbox" name="labels" value="${l.id}" ${card?.label_ids?.includes(l.id) ? "checked" : ""} />
              <span><i class="swatch" style="--swatch:${safeColor(l.color)}"></i>${l.name}</span>
            </label>`
        )}
      </div>`
    : html`<p class="field-hint">Este tablero aún no tiene etiquetas.</p>`;

  formDialog({
    title: editing ? "Editar tarjeta" : "Nueva tarjeta",
    description: editing ? html`<span class="mono">#${card.id}</span> · creada ${relative(card.created_at)}` : null,
    submitLabel: editing ? "Guardar cambios" : "Crear tarjeta",
    footerStart: editing ? html`<button class="btn btn-ghost btn-danger-text" type="button" data-delete>${icon("trash")}Eliminar</button>` : "",
    body: html`
      ${field("Título", html`<input name="title" required maxlength="200" autocomplete="off" placeholder="¿Qué hay que hacer?" value="${card?.title || ""}" autofocus />`)}
      ${field("Descripción", html`<textarea name="description" rows="4" placeholder="Contexto, criterios de aceptación, enlaces… (opcional)">${card?.description || ""}</textarea>`)}
      <div class="field"><span class="field-label" id="prio-label">Prioridad</span>${priorityControl}</div>
      <div class="grid-2">
        ${field("Responsable", assignee)}
        ${field("Columna", html`<select name="column">${columnOptions}</select>`, editing ? "Cambiarla mueve la tarjeta y respeta el WIP" : null)}
      </div>
      <div class="field"><span class="field-label">Etiquetas</span>${labelPicker}</div>`,
    onOpen(dialog) {
      const del = $("[data-delete]", dialog);
      if (!del) return;
      del.addEventListener("click", async () => {
        const ok = await confirmDialog({
          title: "¿Eliminar esta tarjeta?",
          message: `“${card.title}” y su historial de movimientos se borrarán. No se puede deshacer.`,
          confirmLabel: "Eliminar tarjeta",
        });
        if (!ok) return;
        await busy(del, async () => {
          try {
            await api.deleteCard(card.id);
            dialog.close("deleted");
            await refreshBoard();
            toast("Tarjeta eliminada", "success");
          } catch (err) {
            toast(err.message, "error");
          }
        });
      });
    },
    async onSubmit(form) {
      const targetCol = Number(form.column.value);
      const data = {
        title: form.title.value.trim(),
        description: form.description.value.trim(),
        priority: form.querySelector('[name="priority"]:checked')?.value || "medium",
        assignee_id: form.assignee.value ? Number(form.assignee.value) : null,
        label_ids: $$('[name="labels"]:checked', form).map((i) => Number(i.value)),
      };
      if (editing) {
        await api.updateCard(card.id, data);
        if (targetCol !== card.column_id) {
          try {
            await api.moveCard(card.id, targetCol);
          } catch (err) {
            await refreshBoard();
            if (err.code === "wip_limit_reached") throw new Error("Los cambios se guardaron, pero la columna destino alcanzó su límite de WIP y la tarjeta no se movió.");
            throw err;
          }
        }
      } else {
        await api.createCard(targetCol, data);
      }
      await refreshBoard();
      toast(editing ? "Tarjeta actualizada" : "Tarjeta creada", "success");
    },
  });
}

export function priorityGlyph(priority) {
  const level = PRIORITIES[priority]?.level || 2;
  return html`<span class="prio prio-${priority}" aria-hidden="true">${[1, 2, 3].map((i) => html`<i class="${i <= level ? "on" : ""}"></i>`)}</span>`;
}

const SWATCHES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];

export function labelsDialog() {
  if (!store.board) return;
  const dialog = openDialog(
    html`
      <div class="dialog-panel">
        <header class="dialog-head">
          <div>
            <h2 id="labels-title">Etiquetas</h2>
            <p class="dialog-desc">Clasifican las tarjetas de “${store.board.name}”.</p>
          </div>
          <button class="icon-btn" type="button" data-close aria-label="Cerrar">${icon("x")}</button>
        </header>
        <div class="dialog-body">
          <ul class="label-list" data-list></ul>
          <form class="label-form" data-form novalidate>
            <div class="field">
              <span class="field-label">Nueva etiqueta</span>
              <div class="label-form-row">
                <input name="name" required maxlength="80" autocomplete="off" placeholder="p. ej. Bug" aria-label="Nombre de la etiqueta" />
                <button class="btn" type="submit">${icon("plus")}Agregar</button>
              </div>
            </div>
            <fieldset class="swatches">
              <legend class="sr-only">Color</legend>
              ${SWATCHES.map(
                (c, i) => html`
                  <label class="swatch-option" title="${c}">
                    <input type="radio" name="color" value="${c}" ${i === 0 ? "checked" : ""} aria-label="Color ${c}" />
                    <i class="swatch" style="--swatch:${c}"></i>
                  </label>`
              )}
              <label class="swatch-option swatch-custom" title="Color personalizado">
                <input type="radio" name="color" value="custom" aria-label="Color personalizado" />
                <input type="color" name="custom" value="#52514e" aria-label="Elegir color personalizado" />
              </label>
            </fieldset>
            <p class="form-error" role="alert" data-error></p>
          </form>
        </div>
        <footer class="dialog-foot">
          <div class="dialog-foot-start"></div>
          <button class="btn btn-primary" type="button" data-close>Listo</button>
        </footer>
      </div>`,
    { labelledBy: "labels-title" }
  );

  const list = $("[data-list]", dialog);
  const form = $("[data-form]", dialog);
  const error = $("[data-error]", dialog);

  const renderList = () => {
    const labels = store.board.labels || [];
    const usage = (id) => store.board.cards.filter((c) => c.label_ids?.includes(id)).length;
    list.innerHTML = labels.length
      ? html`${labels.map(
          (l) => html`
            <li>
              <span class="label-chip"><i class="swatch" style="--swatch:${safeColor(l.color)}"></i>${l.name}</span>
              <span class="muted small">${usage(l.id)} ${usage(l.id) === 1 ? "tarjeta" : "tarjetas"}</span>
              <button class="icon-btn icon-btn-sm" type="button" data-remove="${l.id}" aria-label="Eliminar etiqueta ${l.name}">${icon("trash")}</button>
            </li>`
        )}`
      : html`<li class="empty-inline">Todavía no hay etiquetas.</li>`;
  };
  renderList();

  form.custom.addEventListener("input", () => (form.querySelector('[value="custom"]').checked = true));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.textContent = "";
    if (!form.checkValidity()) return form.reportValidity();
    const choice = form.querySelector('[name="color"]:checked').value;
    const color = choice === "custom" ? form.custom.value : choice;
    await busy(form.querySelector('[type="submit"]'), async () => {
      try {
        await api.createLabel(store.board.id, { name: form.name.value.trim(), color });
        await refreshBoard();
        form.name.value = "";
        form.name.focus();
        renderList();
      } catch (err) {
        error.textContent = err.message;
      }
    });
  });

  list.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    await busy(btn, async () => {
      try {
        await api.deleteLabel(Number(btn.dataset.remove));
        await refreshBoard();
        renderList();
      } catch (err) {
        error.textContent = err.message;
      }
    });
  });
}

export const avatar = (user, size = "") =>
  user ? html`<span class="avatar ${size}" role="img" data-tip="${user.name}" aria-label="Responsable: ${user.name}">${initials(user.name)}</span>` : "";
