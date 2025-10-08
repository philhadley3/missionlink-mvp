// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import NavBar from "./components/NavBar.jsx";
import GlobeView from "./pages/GlobeView.jsx";
import MissionaryDashboard from "./pages/MissionaryDashboard.jsx";
import Login from "./pages/Login.jsx";
import SignUp from "./pages/SignUp.jsx";

function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* App shell */}
        <div className="min-h-[100dvh] flex flex-col bg-white">
          {/* Fixed, high z-index nav (from NavBar.jsx) */}
          <NavBar />

          {/* Main content lives *below* the 64px navbar */}
          <main
            className="
              relative z-0
              flex-1
              pt-16               /* space for fixed nav (h-16) */
              overflow-x-hidden
              /* Let pages control their own vertical scrolling.
                 If you prefer whole-page scroll instead, remove the next line. */
              overflow-y-auto
              "
          >
            <Routes>
              <Route path="/" element={<Navigate to="/globe" replace />} />
              <Route path="/globe" element={<GlobeView />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />

              {/* 🔐 Private missionary dashboard */}
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <MissionaryDashboard />
                  </PrivateRoute>
                }
              />

              <Route path="*" element={<Navigate to="/globe" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
