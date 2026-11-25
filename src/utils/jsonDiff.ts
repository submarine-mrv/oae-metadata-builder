import { create, type Delta } from "jsondiffpatch";

/** A value on one side; a missing property is distinct from `null`. */
export type DiffSide = { present: false } | { present: true; value: unknown };

export type JsonDiffRow = {
  /** JSON Pointer (RFC 6901); "" is the whole value. For a move, the Local position. */
  path: string;
  change: "added" | "removed" | "changed" | "moved";
  left: DiffSide;
  right: DiffSide;
  /** For a move, the Cloud position. */
  to?: string;
};

const MISSING: DiffSide = { present: false };
const present = (value: unknown): DiffSide => ({ present: true, value });

// Key-sorted JSON, so objects that differ only in key order hash the same.
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, inner) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : inner,
  );

// Array items are matched by content so an insertion or deletion is one whole-item row rather
// than shifting every later index. See `rows` for how edited objects are recovered.
const differ = create({
  objectHash: (item: object) => canonical(item),
  arrays: { detectMove: true, includeValueOnMove: true },
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const escapeSegment = (segment: string) => segment.replaceAll("~", "~0").replaceAll("/", "~1");

// Like JSON, an undefined property counts as missing.
const normalize = (value: unknown): unknown =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

/** Flattens a jsondiffpatch delta into one row per changed path. */
function rows(delta: Delta, path: string): JsonDiffRow[] {
  if (delta === undefined) return [];
  if (Array.isArray(delta)) {
    if (delta.length === 1)
      return [{ path, change: "added", left: MISSING, right: present(delta[0]) }];
    if (delta.length === 2) {
      return [{ path, change: "changed", left: present(delta[0]), right: present(delta[1]) }];
    }
    return [{ path, change: "removed", left: present(delta[0]), right: MISSING }];
  }
  const entries = Object.entries(delta as Record<string, Delta>);
  if ((delta as { _t?: string })._t !== "a") {
    return entries
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .flatMap(([key, child]) => rows(child, `${path}/${escapeSegment(key)}`));
  }
  // Array delta: "_i" keys are Local indices (removed or moved), plain keys are Cloud indices.
  // Content matching reports an edited object as removed + added at the same index; diff those
  // pairs as one edited item so a single changed property is one row.
  const record = delta as Record<string, Delta>;
  const edited = new Map<number, [unknown, unknown]>();
  for (const [key, child] of entries) {
    const removed = record[`_${key}`];
    const isAdd = Array.isArray(child) && child.length === 1;
    const isRemove = Array.isArray(removed) && removed.length === 3 && removed[2] === 0;
    if (isAdd && isRemove && isObject(child[0]) && isObject(removed[0]))
      edited.set(Number(key), [removed[0], child[0]]);
  }
  return entries
    .filter(([key]) => key !== "_t" && !(key.startsWith("_") && edited.has(Number(key.slice(1)))))
    .map(([key, child]) => {
      const local = key.startsWith("_");
      const index = Number(local ? key.slice(1) : key);
      const move = local && Array.isArray(child) && child[2] === 3;
      const result: JsonDiffRow[] = move
        ? [
            {
              path: `${path}/${index}`,
              to: `${path}/${child[1]}`,
              change: "moved",
              left: present(child[0]),
              right: present(child[0]),
            },
          ]
        : !local && edited.has(index)
          ? rows(differ.diff(...(edited.get(index) as [unknown, unknown])), `${path}/${index}`)
          : rows(child, `${path}/${index}`);
      return { index, local, result };
    })
    .sort((a, b) => a.index - b.index || Number(b.local) - Number(a.local))
    .flatMap(({ result }) => result);
}

/** Only what differs between two JSON-like values, as a semantic diff via jsondiffpatch. */
export function jsonDiff(left: DiffSide, right: DiffSide): JsonDiffRow[] {
  const a = left.present ? normalize(left.value) : undefined;
  const b = right.present ? normalize(right.value) : undefined;
  if (a === undefined && b === undefined) return [];
  if (a === undefined) return [{ path: "", change: "added", left: MISSING, right: present(b) }];
  if (b === undefined) return [{ path: "", change: "removed", left: present(a), right: MISSING }];
  return rows(differ.diff(a, b), "");
}

/** Strings, numbers, booleans and null read fine as plain text; anything else needs the JSON diff. */
export function isScalar(side: DiffSide): boolean {
  return !side.present || side.value === null || typeof side.value !== "object";
}
