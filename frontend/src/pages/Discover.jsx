import { useEffect, useState } from "react";
import UserCard from "../components/UserCard.jsx";
import { api } from "../api.js";

export default function Discover({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    try {
      const [allUsers, myFriends, mySentRequests] = await Promise.all([
        api.getUsers(currentUser.id),
        api.getFriends(currentUser.id),
        api.getSentRequests(currentUser.id),
      ]);
      setUsers(allUsers);
      setFriends(myFriends);
      setSentRequests(mySentRequests);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

  async function handleSendRequest(toId) {
    setError("");
    try {
      await api.sendRequest(currentUser.id, toId);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  function statusFor(user) {
    if (friends.some((f) => f.id === user.id)) return "friends";
    if (sentRequests.some((r) => r.toId === user.id)) return "pending";
    return "none";
  }

  if (loading) return <p>Cargando personas...</p>;

  return (
    <div className="page">
      <h1>Descubrir gente</h1>
      {error && <p className="error">{error}</p>}
      {users.length === 0 && <p>No hay más perfiles por ahora.</p>}
      <div className="card-grid">
        {users.map((user) => {
          const status = statusFor(user);
          return (
            <UserCard
              key={user.id}
              user={user}
              footer={
                status === "friends" ? (
                  <span className="badge badge-success">Ya sois amigos</span>
                ) : status === "pending" ? (
                  <span className="badge">Solicitud enviada</span>
                ) : (
                  <button onClick={() => handleSendRequest(user.id)}>Enviar solicitud</button>
                )
              }
            />
          );
        })}
      </div>
    </div>
  );
}
