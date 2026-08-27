import { Router } from "express";
import {
  users,
  getUserById,
  createUser,
  createFriendRequest,
  getRequestById,
  getFriendsOf,
  getPendingRequestsFor,
  getSentPendingRequestsFrom,
  hasPendingOrAcceptedRequest,
  areFriends,
} from "../data.js";

export const router = Router();

router.get("/users", (req, res) => {
  const { excludeId } = req.query;
  const list = excludeId ? users.filter((u) => u.id !== excludeId) : users;
  res.json(list);
});

router.get("/users/:id", (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json(user);
});

router.post("/users", (req, res) => {
  const { name, age, bio, interests } = req.body || {};
  if (!name || !age) {
    return res.status(400).json({ error: "El nombre y la edad son obligatorios" });
  }
  const user = createUser({
    name,
    age,
    bio: bio || "",
    interests: Array.isArray(interests) ? interests : [],
  });
  res.status(201).json(user);
});

router.get("/users/:id/friends", (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json(getFriendsOf(user.id));
});

router.get("/users/:id/requests", (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  const pending = getPendingRequestsFor(user.id).map((r) => ({
    ...r,
    from: getUserById(r.fromId),
  }));
  res.json(pending);
});

router.get("/users/:id/sent-requests", (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json(getSentPendingRequestsFrom(user.id));
});

router.post("/requests", (req, res) => {
  const { fromId, toId } = req.body || {};
  if (!fromId || !toId) {
    return res.status(400).json({ error: "fromId y toId son obligatorios" });
  }
  if (fromId === toId) {
    return res.status(400).json({ error: "No puedes enviarte una solicitud a ti mismo" });
  }
  if (!getUserById(fromId) || !getUserById(toId)) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }
  if (hasPendingOrAcceptedRequest(fromId, toId)) {
    return res.status(409).json({ error: "Ya existe una solicitud entre estos usuarios" });
  }
  const request = createFriendRequest(fromId, toId);
  res.status(201).json(request);
});

router.post("/requests/:id/accept", (req, res) => {
  const request = getRequestById(req.params.id);
  if (!request) return res.status(404).json({ error: "Solicitud no encontrada" });
  request.status = "accepted";
  res.json(request);
});

router.post("/requests/:id/reject", (req, res) => {
  const request = getRequestById(req.params.id);
  if (!request) return res.status(404).json({ error: "Solicitud no encontrada" });
  request.status = "rejected";
  res.json(request);
});

router.get("/users/:idA/friends-with/:idB", (req, res) => {
  const { idA, idB } = req.params;
  res.json({ areFriends: areFriends(idA, idB) });
});
