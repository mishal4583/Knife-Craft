import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startPlatform } from "@/game/PlayablesSDK";
import { App } from "./App";
import "./styles.css";

// Start the Playgama Bridge right away (it must finish initializing before any
// SDK call). `game_ready` is sent later, once the Kitchen/Preparation is interactive.
startPlatform();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element missing from index.html");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
