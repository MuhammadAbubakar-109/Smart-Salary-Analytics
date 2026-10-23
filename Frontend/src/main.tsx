import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Global styles (design tokens, reset, base typography) load first so that
// component styles in App.css can rely on them.
import "./styles.css";
import App from "./App";

const APP_TITLE = "Salary Estimator";
const THEME_COLOR = "#0f2438"; // matches --ink in styles.css

/** Sets the tab title and the mobile browser bar color if index.html doesn't. */
function applyDocumentMeta() {
  if (!document.title) document.title = APP_TITLE;

  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = THEME_COLOR;
    document.head.appendChild(meta);
  }
}

applyDocumentMeta();

const container = document.getElementById("root");
if (!container) {
  throw new Error('Root element "#root" not found. Check that index.html contains <div id="root"></div>.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);