import { useEffect, useState } from "react";
import Avatar from "../components/Avatar.jsx";
import { api } from "../api.js";

export default function ChooseProfile({ onLogin }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", age: "", bio: "", interests: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.getUsers().then(setUsers).catch((e) => setError(e.message));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    if (!form.name || !form.age) {
      setError("El nombre y la edad son obligatorios");
      return;
    }
    setCreating(true);
    try {
      const user = await api.createUser({
        name: form.name,
        age: Number(form.age),
        bio: form.bio,
        interests: form.interests
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="choose-profile">
      <h1>OnlyFKM</h1>
      <p className="subtitle">Conecta con gente nueva y haz amigos.</p>

      {error && <p className="error">{error}</p>}

      <section>
        <h2>Elige un perfil existente</h2>
        <div className="profile-grid">
          {users.map((user) => (
            <button key={user.id} className="profile-pick" onClick={() => onLogin(user)}>
              <Avatar user={user} />
              <span>{user.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>O crea un perfil nuevo</h2>
        <form onSubmit={handleCreate} className="profile-form">
          <input
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            type="number"
            placeholder="Edad"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
          />
          <textarea
            placeholder="Cuéntanos algo sobre ti"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
          <input
            placeholder="Intereses separados por comas (p. ej. Esports, Programación)"
            value={form.interests}
            onChange={(e) => setForm({ ...form, interests: e.target.value })}
          />
          <button type="submit" disabled={creating}>
            {creating ? "Creando..." : "Crear perfil y entrar"}
          </button>
        </form>
      </section>
    </div>
  );
}
