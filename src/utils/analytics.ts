/**
 * Google Analytics 4 integration.
 *
 * No-op unless VITE_GA_MEASUREMENT_ID is set, so local dev and tests never reach
 * Google. Only page paths and counts are sent, never form field values.
 */

import type { AnyRouter } from "@tanstack/react-router";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const SCRIPT_ID = "ga4-gtag";

function getMeasurementId(): string {
  return import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() ?? "";
}

/** gtag.js needs the native `arguments` object; a plain array gets dropped. */
function installGtag() {
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // biome-ignore lint/complexity/noArguments: gtag.js requires the arguments object
    window.dataLayer?.push(arguments);
  };
}

function injectGtagScript(measurementId: string) {
  if (document.getElementById(SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  script.async = true;
  document.head.appendChild(script);
}

function sendPageView() {
  window.gtag?.("event", "page_view", {
    page_location: window.location.href,
    page_path: `${window.location.pathname}${window.location.search}`,
    page_title: document.title,
  });
}

/** Sends a custom event. No-op when analytics is disabled. */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (params) {
    window.gtag?.("event", name, params);
  } else {
    window.gtag?.("event", name);
  }
}

/** Loads gtag.js and tracks page views off the router. */
export function initAnalytics(router: AnyRouter) {
  if (typeof window === "undefined") return;

  const measurementId = getMeasurementId();
  if (!measurementId) return;

  injectGtagScript(measurementId);
  installGtag();

  window.gtag?.("js", new Date());
  // gtag's automatic page view would fire on "/" before its redirect to /overview.
  window.gtag?.("config", measurementId, { send_page_view: false });

  // onResolved also fires for the initial route, so this covers page load.
  router.subscribe("onResolved", sendPageView);
}
