export function buildAuthRedirectUrl({
  type,
  returnTo,
  origin = window.location.origin,
}: {
  type: "signup" | "recovery" | "email_change";
  returnTo: string;
  origin?: string;
}): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("type", type);
  url.searchParams.set("returnTo", returnTo);
  return url.toString();
}

export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value?.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;

  try {
    const decoded = decodeURIComponent(value);
    if (decoded !== value || decoded.startsWith("//") || decoded.startsWith("/\\")) return null;
    const resolved = new URL(decoded, window.location.origin);
    if (resolved.origin !== window.location.origin) return null;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
}
