export const SLUG_CONFLICT_MESSAGE =
  "This ID is already in use. Choose a unique ID or leave it empty. Changes to this project will not sync to the cloud until this is fixed.";

/** A save rejected because the backend already reserves some of the project's IDs. */
export class SlugConflictError extends Error {
  constructor(
    public readonly projectId: string,
    public readonly ids: string[],
  ) {
    super(SLUG_CONFLICT_MESSAGE);
    this.name = "SlugConflictError";
  }
}
