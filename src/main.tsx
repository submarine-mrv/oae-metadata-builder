import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Import Mantine styles BEFORE globals.css so our styles take precedence.
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@/globals.css";
import "@/uiSchemaConstants.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
