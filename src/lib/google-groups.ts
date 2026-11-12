export function isValidGoogleGroupUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname === "groups.google.com";
  } catch {
    return false;
  }
}
