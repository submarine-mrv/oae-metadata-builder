export const DUPLICATE_ID_MESSAGE =
  "This ID is already in use. Choose a unique ID or leave it empty. Changes to this project will not sync to the cloud until this is fixed.";

/** A save rejected because some of the project's IDs are already in use. */
export class DuplicateIdError extends Error {
  constructor(
    public readonly projectId: string,
    public readonly ids: string[],
  ) {
    super(DUPLICATE_ID_MESSAGE);
    this.name = "DuplicateIdError";
  }
}
