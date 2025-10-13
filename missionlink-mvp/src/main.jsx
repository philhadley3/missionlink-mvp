// src/main.jsx
import { API_BASE } from "./lib/api";  // <- add this line
import "./lib/api";                    // keep the side-effect import

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./theme.css";

console.log("[boot] API_BASE =", API_BASE);  // should print in prod console

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
