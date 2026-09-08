import { test as base } from "@playwright/test";
import { stubMapNetwork } from "./map-network";

/** `test` with the map CDNs stubbed on every context. Specs import from here. */
export const test = base.extend<{ mapNetwork: void }>({
  mapNetwork: [
    async ({ context }, use) => {
      await stubMapNetwork(context);
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
