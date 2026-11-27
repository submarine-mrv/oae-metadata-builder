const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** 32-bit FNV-1a. */
function fnv1a(bytes: Uint8Array, lane: number): string {
  let hash = (0x811c9dc5 ^ Math.imul(lane + 1, 0x9e3779b1)) >>> 0;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * The same UUID for the same seed in every tab and build, so IDs from before UUIDs map
 * consistently. Not for new entities, which use crypto.randomUUID(). Laid out as an RFC 9562
 * version 8 (custom) UUID.
 */
export function stableUuid(seed: string): string {
  const bytes = new TextEncoder().encode(seed);
  const hex = [0, 1, 2, 3].map((lane) => fnv1a(bytes, lane)).join("");
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
