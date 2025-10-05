// src/components/NavBar.jsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      {/* Left side */}
      <div className="nav-left">
        <button onClick={() => navigate("/globe")}>Globe</button>
        {user && (
          <button onClick={() => navigate("/dashboard")}>Dashboard</button>
        )}
      </div>

      {/* Center verse */}
      <div className="nav-center">
        <span className="verse">
          “Go into all the world and preach the gospel to every creature." Mark 16:15
        </span>
      </div>

      {/* Right side */}
      <div className="nav-right">
        {!user ? (
          <button onClick={() => navigate("/login")}>Sign In</button>
        ) : (
          <button onClick={logout}>Sign Out</button>
        )}
      </div>
    </nav>
  );
}
