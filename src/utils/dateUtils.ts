import dayjs from "dayjs";

export const dateUtils = {
  parseInterval(v?: string | null): { start: string; end: string } {
    if (!v || typeof v !== "string") return { start: "", end: "" };
    const [start, end] = v.split("/");
    return {
      start: start || "",
      end: end && end !== ".." ? end : ""
    };
  },

  buildInterval(start: string, end: string): string | undefined {
    if (!start) return undefined;
    return `${start}/${end || ".."}`;
  },

  validateDate(input: string): boolean {
    if (!input) return true; // empty is valid
    const d = dayjs(input, "YYYY-MM-DD", true);
    return d.isValid();
  }
};
