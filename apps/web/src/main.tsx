import "@arcgis/core/assets/esri/themes/light/main.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Import and define ArcGIS Map Components
import { defineCustomElements as defineMapElements } from "@arcgis/map-components/dist/loader";

// Initialize the web components
defineMapElements(window, {
  resourcesUrl: "https://js.arcgis.com/map-components/4.34/assets"
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
