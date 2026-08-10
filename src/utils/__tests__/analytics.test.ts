import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initAnalytics, trackEvent } from "@/utils/analytics";

const MEASUREMENT_ID = "G-TEST12345";
const SCRIPT_SELECTOR = "#ga4-gtag";

/** initAnalytics only calls subscribe, so a structural fake is enough. */
function fakeRouter() {
  const subscribe = vi.fn();
  // biome-ignore lint/suspicious/noExplicitAny: structural fake for AnyRouter
  return { router: { subscribe } as any, subscribe };
}

function gtagCalls(): unknown[][] {
  return (window.dataLayer ?? []).map((entry) => Array.from(entry as IArguments));
}

beforeEach(() => {
  document.head.innerHTML = "";
  window.dataLayer = undefined;
  window.gtag = undefined;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("analytics with no measurement ID", () => {
  it("does not load gtag.js or define window.gtag", () => {
    const { router, subscribe } = fakeRouter();

    initAnalytics(router);

    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();
    expect(window.gtag).toBeUndefined();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("makes trackEvent a silent no-op", () => {
    expect(() => trackEvent("metadata_export", { datasets: 2 })).not.toThrow();
    expect(window.dataLayer).toBeUndefined();
  });
});

describe("analytics with a measurement ID", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", MEASUREMENT_ID);
  });

  it("injects gtag.js exactly once", () => {
    const { router } = fakeRouter();

    initAnalytics(router);
    initAnalytics(router);

    const scripts = document.querySelectorAll(SCRIPT_SELECTOR);
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute("src")).toBe(
      `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`,
    );
  });

  it("configures GA with automatic page views disabled", () => {
    const { router } = fakeRouter();

    initAnalytics(router);

    expect(gtagCalls()).toContainEqual(["config", MEASUREMENT_ID, { send_page_view: false }]);
  });

  it("pushes commands as arguments objects, not arrays", () => {
    const { router } = fakeRouter();

    initAnalytics(router);

    // gtag.js drops commands pushed as plain arrays.
    for (const entry of window.dataLayer ?? []) {
      expect(Array.isArray(entry)).toBe(false);
      expect(typeof (entry as IArguments).length).toBe("number");
    }
  });

  it("does not send a page view before the router resolves", () => {
    // "/" redirects to /overview, so a view at init would count the wrong path.
    const { router } = fakeRouter();

    initAnalytics(router);

    expect(gtagCalls().filter(([, name]) => name === "page_view")).toHaveLength(0);
  });

  it("sends exactly one page view per resolved router navigation", () => {
    const { router, subscribe } = fakeRouter();

    initAnalytics(router);
    expect(subscribe).toHaveBeenCalledWith("onResolved", expect.any(Function));

    // The first call is the router's initial resolution, which covers page load.
    const onResolved = subscribe.mock.calls[0][1] as () => void;
    onResolved();
    onResolved();

    const pageViews = gtagCalls().filter(([, name]) => name === "page_view");
    expect(pageViews).toHaveLength(2);
    expect(pageViews[0][2]).toMatchObject({
      page_path: `${window.location.pathname}${window.location.search}`,
      page_location: window.location.href,
    });
  });

  it("omits the params argument for events with no parameters", () => {
    const { router } = fakeRouter();
    initAnalytics(router);

    trackEvent("session_discard");

    expect(gtagCalls()).toContainEqual(["event", "session_discard"]);
  });

  it("forwards custom events through gtag", () => {
    const { router } = fakeRouter();
    initAnalytics(router);

    trackEvent("metadata_export", { sections: "project,dataset", datasets: 2 });

    expect(gtagCalls()).toContainEqual([
      "event",
      "metadata_export",
      { sections: "project,dataset", datasets: 2 },
    ]);
  });
});
