import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Import Mantine styles BEFORE globals.css so our styles take precedence.
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@/globals.css";
import "@/uiSchemaConstants.css";
import { initAnalytics } from "@/utils/analytics";
import App from "./App";
import { router } from "./router";

// Outside React so StrictMode's double mount can't duplicate page views.
initAnalytics(router);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
