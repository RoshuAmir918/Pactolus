import React from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import "./styles.css";

const container = document.getElementById("app");

if (!container) {
  throw new Error("Task pane root container is missing.");
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
