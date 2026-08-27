import { NavLink } from "react-router-dom";
import Avatar from "./Avatar.jsx";

export default function Navbar({ currentUser, onLogout }) {
  return (
    <header className="navbar">
      <div className="navbar-brand">OnlyFKM</div>
      <nav className="navbar-links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Descubrir
        </NavLink>
        <NavLink to="/requests" className={({ isActive }) => (isActive ? "active" : "")}>
          Solicitudes
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => (isActive ? "active" : "")}>
          Mi perfil
        </NavLink>
      </nav>
      <div className="navbar-user">
        <Avatar user={currentUser} size={36} />
        <span>{currentUser.name}</span>
        <button className="link-button" onClick={onLogout}>
          Salir
        </button>
      </div>
    </header>
  );
}
