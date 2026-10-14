import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Self-hosted fonts (Cockpit v2): latin subsets, only what the design system uses.
// Newsreader (display, client quotes in italic) with its optical-size axis; Atkinson (text); Overpass Mono (figures).
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "@fontsource/atkinson-hyperlegible-next/latin-400.css";
import "@fontsource/atkinson-hyperlegible-next/latin-400-italic.css";
import "@fontsource/atkinson-hyperlegible-next/latin-600.css";
import "@fontsource/atkinson-hyperlegible-next/latin-700.css";
import "@fontsource/overpass/latin-600.css";
import "@fontsource/overpass/latin-700.css";
import "@fontsource/overpass/latin-800.css";
import "@fontsource/overpass-mono/latin-500.css";
import "@fontsource/overpass-mono/latin-600.css";
import "./styles/tokens.css";
import "./styles/app.css";
import App from "./App";
import { applyAppearance, followDevice, readAppearance } from "./lib/appearance";

applyAppearance(readAppearance());
followDevice(readAppearance);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
