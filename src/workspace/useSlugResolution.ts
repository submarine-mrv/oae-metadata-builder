import { useEffect, useRef } from "react";
import type { Resolution } from "./slugs";

type Pinned = { id: string; slug: string; canonical: string };

/**
 * Resolves a URL slug, and keeps resolving to the same record when its human ID is edited
 * while open: the old slug then matches nothing, until the URL catches up with `canonical`.
 */
export function useSlugResolution<T extends { id: string }>(
  slug: string,
  items: T[],
  resolve: (slug: string, items: T[]) => Resolution<T>,
  canonicalSlug: (item: T, items: T[]) => string,
): { resolution: Resolution<T>; canonical: string | null } {
  const pinned = useRef<Pinned | null>(null);
  const pin = pinned.current;
  const pinnedItem =
    pin && (slug === pin.slug || slug === pin.canonical)
      ? items.find((item) => item.id === pin.id)
      : undefined;
  const resolution: Resolution<T> = pinnedItem
    ? { kind: "found", value: pinnedItem }
    : resolve(slug, items);
  const found = resolution.kind === "found" ? resolution.value : null;
  const canonical = found ? canonicalSlug(found, items) : null;

  useEffect(() => {
    pinned.current = found && canonical ? { id: found.id, slug, canonical } : null;
  });

  return { resolution, canonical };
}
