import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { firstFrameReady } from "@/game/PlayablesSDK";
import { App } from "./App";
import "./styles.css";

// The loading state (this HTML shell + first paint) is already on
// screen by the time this module runs — that's the "first visible
// frame" the Playables SDK wants to hear about (§22). gameReady() is
// called later, by App, once the Kitchen UI is actually interactive.
firstFrameReady();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element missing from index.html");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
