// src/components/NavBar.jsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav
      role="navigation"
      className="fixed top-0 inset-x-0 z-[100] bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 shadow"
    >
      {/* Bar content */}
      <div className="relative h-16 px-4 md:px-6 flex items-center">
        {/* Left */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/globe")}
            className="px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-black/5"
          >
            Globe
          </button>
          {user && (
            <button
              onClick={() => navigate("/dashboard")}
              className="px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-black/5"
            >
              Dashboard
            </button>
          )}
        </div>

        {/* Center verse (kept clickable-off so it doesn’t block buttons) */}
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 max-w-[70%] text-center">
          <span className="block text-sm md:text-base font-medium text-neutral-700 truncate">
            “Go into all the world and preach the gospel to every creature." Mark 16:15
          </span>
        </div>

        {/* Right */}
        <div className="ml-auto flex items-center gap-2">
          {!user ? (
            <button
              onClick={() => navigate("/login")}
              className="px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-black/5"
            >
              Sign In
            </button>
          ) : (
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-black/5"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
