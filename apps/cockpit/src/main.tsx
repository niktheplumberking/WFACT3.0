import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Self-hosted fonts (Step 4C): latin subsets, only the weights the design uses.
import "@fontsource/atkinson-hyperlegible-next/latin-400.css";
import "@fontsource/atkinson-hyperlegible-next/latin-400-italic.css";
import "@fontsource/atkinson-hyperlegible-next/latin-700.css";
import "@fontsource/overpass/latin-600.css";
import "@fontsource/overpass/latin-700.css";
import "@fontsource/overpass/latin-800.css";
import "@fontsource/overpass-mono/latin-500.css";
import "./styles/tokens.css";
import "./styles/app.css";
import App from "./App";
import { applyTheme, readThemePref } from "./lib/state";

applyTheme(readThemePref());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
