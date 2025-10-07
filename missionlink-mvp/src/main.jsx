import "./lib/api"; // ensures api.js runs at startup
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./theme.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);