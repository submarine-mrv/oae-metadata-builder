/** A value on one side; a missing property is distinct from `null`. */
export type DiffSide = { present: false } | { present: true; value: unknown };

export type JsonDiffRow = {
  /** JSON Pointer (RFC 6901); "" is the whole value. */
  path: string;
  change: "added" | "removed" | "changed";
  left: DiffSide;
  right: DiffSide;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Like JSON, an undefined property counts as missing.
const member = (container: Record<string, unknown> | unknown[], key: string | number): DiffSide =>
  key in container && (container as Record<string, unknown>)[key] !== undefined
    ? { present: true, value: (container as Record<string, unknown>)[key] }
    : { present: false };

const escapeSegment = (segment: string) => segment.replaceAll("~", "~0").replaceAll("/", "~1");

/**
 * Only what differs between two JSON-like values. Object key order is ignored; arrays compare
 * by index, so a reorder or insertion shows as changed positions. A type or container change is
 * one row at that path.
 */
export function jsonDiff(left: DiffSide, right: DiffSide, path = ""): JsonDiffRow[] {
  if (left.present && left.value === undefined) left = { present: false };
  if (right.present && right.value === undefined) right = { present: false };
  if (!left.present && !right.present) return [];
  if (!left.present) return [{ path, change: "added", left, right }];
  if (!right.present) return [{ path, change: "removed", left, right }];
  const [a, b] = [left.value, right.value];
  if (Array.isArray(a) && Array.isArray(b)) {
    return Array.from({ length: Math.max(a.length, b.length) }, (_, index) =>
      jsonDiff(member(a, index), member(b, index), `${path}/${index}`),
    ).flat();
  }
  if (isObject(a) && isObject(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    return keys.flatMap((key) =>
      jsonDiff(member(a, key), member(b, key), `${path}/${escapeSegment(key)}`),
    );
  }
  return Object.is(a, b) ? [] : [{ path, change: "changed", left, right }];
}

/** Strings, numbers, booleans and null read fine as plain text; anything else needs the JSON diff. */
export function isScalar(side: DiffSide): boolean {
  return !side.present || side.value === null || typeof side.value !== "object";
}
