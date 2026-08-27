import { useEffect, useState } from "react";
import UserCard from "../components/UserCard.jsx";
import { api } from "../api.js";

export default function Requests({ currentUser }) {
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    try {
      const [pending, myFriends] = await Promise.all([
        api.getPendingRequests(currentUser.id),
        api.getFriends(currentUser.id),
      ]);
      setRequests(pending);
      setFriends(myFriends);
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

  async function handleAccept(requestId) {
    setError("");
    try {
      await api.acceptRequest(requestId);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReject(requestId) {
    setError("");
    try {
      await api.rejectRequest(requestId);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p>Cargando solicitudes...</p>;

  return (
    <div className="page">
      <h1>Solicitudes recibidas</h1>
      {error && <p className="error">{error}</p>}
      {requests.length === 0 ? (
        <p>No tienes solicitudes pendientes.</p>
      ) : (
        <div className="card-grid">
          {requests.map((r) => (
            <UserCard
              key={r.id}
              user={r.from}
              footer={
                <div className="button-row">
                  <button onClick={() => handleAccept(r.id)}>Aceptar</button>
                  <button className="secondary" onClick={() => handleReject(r.id)}>
                    Rechazar
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}

      <h1>Mis amigos</h1>
      {friends.length === 0 ? (
        <p>Todavía no tienes amigos. ¡Explora la sección de Descubrir!</p>
      ) : (
        <div className="card-grid">
          {friends.map((friend) => (
            <UserCard key={friend.id} user={friend} />
          ))}
        </div>
      )}
    </div>
  );
}
