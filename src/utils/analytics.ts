/**
 * Google Analytics 4 integration.
 *
 * No-op unless VITE_GA_MEASUREMENT_ID is set, so local dev and tests never reach
 * Google. Only page paths, route labels and counts are sent, never form field
 * values or the project name.
 */

import type { AnyRouter } from "@tanstack/react-router";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const SCRIPT_ID = "ga4-gtag";
/** Written by the OAE Data Commons privacy page on the shared parent domain. */
const OPT_OUT_COOKIE = "oae_analytics_v1";

let activeMeasurementId = "";

function getMeasurementId(): string {
  return import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() ?? "";
}

/**
 * False when the visitor opted out on the Data Commons, or, with no stored choice, when the
 * browser sends Global Privacy Control or Do Not Track.
 */
function analyticsAllowed(): boolean {
  const entry = document.cookie.split("; ").find((c) => c.startsWith(`${OPT_OUT_COOKIE}=`));
  const stored = entry?.slice(OPT_OUT_COOKIE.length + 1);
  if (stored === "on" || stored === "off") return stored === "on";
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return !(nav.globalPrivacyControl === true || nav.doNotTrack === "1");
}

/** Re-reads the opt-out before each hit, so a change made on the Data Commons applies at once. */
function collectionAllowed(): boolean {
  const allowed = analyticsAllowed();
  (window as unknown as Record<string, unknown>)[`ga-disable-${activeMeasurementId}`] = !allowed;
  return allowed;
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

const PAGE_TITLES: Record<string, string> = {
  "/overview": "Overview",
  "/project": "Project",
  "/experiment": "Experiments",
  "/dataset": "Datasets",
  "/projects": "Projects",
  "/about": "About",
  "/how-to": "How-to",
  "/checker": "Checker",
  "/profile": "Profile",
  "/auth/login": "Log in",
  "/auth/sign-up": "Sign up",
  "/auth/forgot-password": "Forgot password",
  "/auth/reset-password": "Reset password",
  "/auth/verify-email": "Verify email",
  "/auth/callback": "Auth callback",
};

/** Fixed label per route; document.title carries the user's project name. */
export function pageTitleFor(pathname: string): string {
  return PAGE_TITLES[pathname] ?? pathname;
}

function sendPageView() {
  if (!collectionAllowed()) return;
  const pageUrl = new URL(window.location.href);
  for (const key of ["email", "token_hash", "code", "error_code", "error_description", "message"]) {
    pageUrl.searchParams.delete(key);
  }
  const sanitizedUrl = pageUrl.toString();
  const pageTitle = pageTitleFor(pageUrl.pathname);

  // Later custom events inherit this instead of document.title.
  window.gtag?.("set", { page_title: pageTitle });
  window.gtag?.("event", "page_view", {
    page_location: sanitizedUrl,
    page_path: `${pageUrl.pathname}${pageUrl.search}`,
    page_title: pageTitle,
  });
}

/** Sends a custom event. No-op when analytics is disabled. */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (!window.gtag || !collectionAllowed()) return;
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
  if (!measurementId || !analyticsAllowed()) return;
  activeMeasurementId = measurementId;

  injectGtagScript(measurementId);
  installGtag();

  window.gtag?.("js", new Date());
  // gtag's automatic page view would fire on "/" before its redirect to /overview.
  window.gtag?.("config", measurementId, { send_page_view: false });
  // GA defaults page_title to document.title, which holds the project name.
  window.gtag?.("set", { page_title: pageTitleFor(window.location.pathname) });

  // onResolved also fires for the initial route, so this covers page load.
  router.subscribe("onResolved", sendPageView);

  // Also covers gtag's own hits, which don't pass through sendPageView or trackEvent. These run
  // before gtag's listeners, so pagehide catches a background tab closed after an opt-out.
  document.addEventListener("visibilitychange", collectionAllowed);
  window.addEventListener("focus", collectionAllowed);
  window.addEventListener("pagehide", collectionAllowed);
}
