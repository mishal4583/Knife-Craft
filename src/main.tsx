import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { startPlatform } from "@/game/PlayablesSDK";
import { App } from "./App";
import "./styles.css";

class GameErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("The game screen failed to render.", error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main
        role="alert"
        style={{
          boxSizing: "border-box",
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#f6e9cf",
          color: "#432a1b",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <section style={{ maxWidth: 360 }}>
          <div aria-hidden="true" style={{ fontSize: 40 }}>🍽️</div>
          <h1 style={{ margin: "12px 0 8px", fontSize: 24 }}>The game hit a snag</h1>
          <p style={{ margin: "0 0 20px", lineHeight: 1.5 }}>
            This screen could not load. Reload the game to continue.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: "1px solid #8c572c",
              borderRadius: 14,
              padding: "12px 20px",
              background: "#75451f",
              color: "#fff8e9",
              font: "inherit",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload game
          </button>
        </section>
      </main>
    );
  }
}

// Start the Playgama Bridge right away (it must finish initializing before any
// SDK call). `game_ready` is sent later, once the Kitchen/Preparation is interactive.
startPlatform();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element missing from index.html");

createRoot(rootEl).render(
  <StrictMode>
    <GameErrorBoundary>
      <App />
    </GameErrorBoundary>
  </StrictMode>,
);
