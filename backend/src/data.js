let nextUserId = 1;
let nextRequestId = 1;

const AVATAR_COLORS = ["#F97362", "#4C9F70", "#4C7CF9", "#F9B23C", "#B15CF9", "#3CC7F9"];

function makeUser({ name, age, bio, interests }) {
  const id = String(nextUserId++);
  return {
    id,
    name,
    age,
    bio,
    interests,
    avatarColor: AVATAR_COLORS[(id - 1) % AVATAR_COLORS.length],
    createdAt: new Date().toISOString(),
  };
}

export const users = [
  makeUser({
    name: "Lucía",
    age: 24,
    bio: "Fan de los esports y las tardes de LAN party. Busco gente para jugar y quedar.",
    interests: ["Esports", "Valorant", "Series"],
  }),
  makeUser({
    name: "Marcos",
    age: 27,
    bio: "Programador en formación, me apasiona la ciberseguridad y los CTFs.",
    interests: ["Ciberseguridad", "CTF", "Programación"],
  }),
  makeUser({
    name: "Elena",
    age: 22,
    bio: "Estudiante en 42 Málaga. Me encanta el senderismo y los videojuegos indie.",
    interests: ["Senderismo", "Indie games", "42 Málaga"],
  }),
  makeUser({
    name: "Diego",
    age: 29,
    bio: "Entrenador de un equipo amateur de League of Legends. Siempre buscando nueva gente.",
    interests: ["League of Legends", "Esports", "Fútbol"],
  }),
];

export const friendRequests = [];

export function getUserById(id) {
  return users.find((u) => u.id === id);
}

export function getRequestById(id) {
  return friendRequests.find((r) => r.id === id);
}

export function createUser(data) {
  const user = makeUser(data);
  users.push(user);
  return user;
}

export function createFriendRequest(fromId, toId) {
  const request = {
    id: String(nextRequestId++),
    fromId,
    toId,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  friendRequests.push(request);
  return request;
}

export function areFriends(userAId, userBId) {
  return friendRequests.some(
    (r) =>
      r.status === "accepted" &&
      ((r.fromId === userAId && r.toId === userBId) ||
        (r.fromId === userBId && r.toId === userAId))
  );
}

export function getFriendsOf(userId) {
  return friendRequests
    .filter((r) => r.status === "accepted" && (r.fromId === userId || r.toId === userId))
    .map((r) => (r.fromId === userId ? r.toId : r.fromId))
    .map((id) => getUserById(id))
    .filter(Boolean);
}

export function getPendingRequestsFor(userId) {
  return friendRequests.filter((r) => r.toId === userId && r.status === "pending");
}

export function getSentPendingRequestsFrom(userId) {
  return friendRequests.filter((r) => r.fromId === userId && r.status === "pending");
}

export function hasPendingOrAcceptedRequest(fromId, toId) {
  return friendRequests.some(
    (r) =>
      r.status !== "rejected" &&
      ((r.fromId === fromId && r.toId === toId) || (r.fromId === toId && r.toId === fromId))
  );
}
