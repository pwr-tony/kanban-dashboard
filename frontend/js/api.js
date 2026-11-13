
const BASE = safeStorage("get", "api_base") || "";
let token = safeStorage("get", "token") || "";
let onUnauthorized = () => {};

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function safeStorage(op, key, value) {
  try {
    if (op === "get") return localStorage.getItem(key);
    if (op === "set") return localStorage.setItem(key, value);
    if (op === "del") return localStorage.removeItem(key);
  } catch {
    return null;
  }
}

export const session = {
  get token() {
    return token;
  },
  set(newToken, user) {
    token = newToken;
    safeStorage("set", "token", newToken);
    safeStorage("set", "user", JSON.stringify(user));
  },
  user() {
    try {
      return JSON.parse(safeStorage("get", "user") || "null");
    } catch {
      return null;
    }
  },
  clear() {
    token = "";
    safeStorage("del", "token");
    safeStorage("del", "user");
  },
  onUnauthorized(fn) {
    onUnauthorized = fn;
  },
};

async function request(method, path, body) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = "Bearer " + token;

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError("No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.", 0);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith("/auth/")) onUnauthorized();
    throw new ApiError(data.error || `Error ${res.status}`, res.status, data.code);
  }
  return data;
}

export const api = {
  login: (email, password) => request("POST", "/auth/login", { email, password }),
  register: (name, email, password) => request("POST", "/auth/register", { name, email, password }),
  users: () => request("GET", "/users"),

  boards: () => request("GET", "/boards"),
  board: (id) => request("GET", `/boards/${id}`),
  createBoard: (b) => request("POST", "/boards", b),
  updateBoard: (id, b) => request("PUT", `/boards/${id}`, b),
  deleteBoard: (id) => request("DELETE", `/boards/${id}`),
  metrics: (id) => request("GET", `/boards/${id}/metrics`),

  createColumn: (boardId, c) => request("POST", `/boards/${boardId}/columns`, c),
  updateColumn: (id, c) => request("PUT", `/columns/${id}`, c),

  createLabel: (boardId, l) => request("POST", `/boards/${boardId}/labels`, l),
  deleteLabel: (id) => request("DELETE", `/labels/${id}`),

  createCard: (columnId, c) => request("POST", `/columns/${columnId}/cards`, c),
  updateCard: (id, c) => request("PUT", `/cards/${id}`, c),
  moveCard: (id, columnId) => request("POST", `/cards/${id}/move`, { column_id: columnId }),
  deleteCard: (id) => request("DELETE", `/cards/${id}`),
};
