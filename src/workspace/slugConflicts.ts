export const SLUG_CONFLICT_MESSAGE =
  "This ID is already in use. Choose a unique ID or leave it empty. Changes to this project will not sync to the cloud until this is fixed.";

export const INVALID_ID_MESSAGE =
  "Use only letters, numbers, - and _. Changes to this project will not sync to the cloud until this is fixed.";

/** Human project and experiment IDs: case-insensitive, letters, digits, `-` and `_` only. */
export function isValidHumanId(id: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id);
}

/** A save rejected because some of the project's IDs are invalid or already reserved. */
export class SlugConflictError extends Error {
  constructor(
    public readonly projectId: string,
    public readonly ids: string[],
    public readonly reason: "taken" | "invalid" = "taken",
  ) {
    super(reason === "taken" ? SLUG_CONFLICT_MESSAGE : INVALID_ID_MESSAGE);
    this.name = "SlugConflictError";
  }
}
