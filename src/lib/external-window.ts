export function openPendingExternalWindow() {
  const popup = window.open("", "_blank");

  if (!popup) {
    return null;
  }

  try {
    popup.opener = null;
  } catch {
    // Some browsers restrict opener assignment on newly opened tabs.
  }

  return popup;
}

export function navigateExternalWindow(popup: Window | null, url: string) {
  if (!popup || popup.closed) {
    window.location.assign(url);
    return false;
  }

  popup.location.replace(url);
  return true;
}

export function closeExternalWindow(popup: Window | null) {
  if (!popup || popup.closed) {
    return;
  }

  popup.close();
}
