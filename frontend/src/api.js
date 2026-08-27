const BASE_URL = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || "Ha ocurrido un error");
  }
  return data;
}

export const api = {
  getUsers: (excludeId) => request(`/users${excludeId ? `?excludeId=${excludeId}` : ""}`),
  getUser: (id) => request(`/users/${id}`),
  createUser: (payload) =>
    request("/users", { method: "POST", body: JSON.stringify(payload) }),
  getFriends: (id) => request(`/users/${id}/friends`),
  getPendingRequests: (id) => request(`/users/${id}/requests`),
  getSentRequests: (id) => request(`/users/${id}/sent-requests`),
  sendRequest: (fromId, toId) =>
    request("/requests", { method: "POST", body: JSON.stringify({ fromId, toId }) }),
  acceptRequest: (id) => request(`/requests/${id}/accept`, { method: "POST" }),
  rejectRequest: (id) => request(`/requests/${id}/reject`, { method: "POST" }),
};
