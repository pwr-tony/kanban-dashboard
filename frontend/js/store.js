
export const store = {
  user: null,
  users: [],
  boards: [],
  boardId: null,
  board: null,
  view: "board",
  filter: "",
};

export const sortedColumns = () => [...(store.board?.columns || [])].sort((a, b) => a.position - b.position || a.id - b.id);

export const cardsIn = (columnId) =>
  (store.board?.cards || []).filter((c) => c.column_id === columnId).sort((a, b) => a.position - b.position || a.id - b.id);

export const userById = (id) => store.users.find((u) => u.id === id);
export const labelById = (id) => (store.board?.labels || []).find((l) => l.id === id);
export const columnById = (id) => (store.board?.columns || []).find((c) => c.id === id);

export function wipState(column, count = cardsIn(column.id).length) {
  const limit = column.wip_limit;
  if (!limit) return "ok";
  if (count > limit) return "over";
  if (count === limit) return "full";
  if (count === limit - 1) return "near";
  return "ok";
}

export const PRIORITIES = {
  high: { label: "Alta", level: 3 },
  medium: { label: "Media", level: 2 },
  low: { label: "Baja", level: 1 },
};
