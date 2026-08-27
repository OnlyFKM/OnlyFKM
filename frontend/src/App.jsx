import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import ChooseProfile from "./pages/ChooseProfile.jsx";
import Discover from "./pages/Discover.jsx";
import Requests from "./pages/Requests.jsx";
import Profile from "./pages/Profile.jsx";
import { api } from "./api.js";

const STORAGE_KEY = "onlyfkm_user_id";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (!savedId) {
      setLoading(false);
      return;
    }
    api
      .getUser(savedId)
      .then(setCurrentUser)
      .catch(() => localStorage.removeItem(STORAGE_KEY))
      .finally(() => setLoading(false));
  }, []);

  function handleLogin(user) {
    localStorage.setItem(STORAGE_KEY, user.id);
    setCurrentUser(user);
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    setCurrentUser(null);
  }

  if (loading) return null;

  if (!currentUser) {
    return <ChooseProfile onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <Navbar currentUser={currentUser} onLogout={handleLogout} />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<Discover currentUser={currentUser} />} />
          <Route path="/requests" element={<Requests currentUser={currentUser} />} />
          <Route path="/profile" element={<Profile currentUser={currentUser} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
