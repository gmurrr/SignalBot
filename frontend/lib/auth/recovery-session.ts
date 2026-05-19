export const passwordRecoveryStorageKey = "zeta-signals-password-recovery";

export function markPasswordRecoverySession() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(passwordRecoveryStorageKey, "true");
}

export function clearPasswordRecoverySession() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(passwordRecoveryStorageKey);
}

export function hasPasswordRecoverySessionMarker() {
  if (typeof window === "undefined") {
    return false;
  }

  if (getPasswordRecoveryLinkError()) {
    return false;
  }

  return window.sessionStorage.getItem(passwordRecoveryStorageKey) === "true" || hasPasswordRecoveryLinkMarker();
}

export function hasPasswordRecoveryLinkMarker() {
  if (typeof window === "undefined") {
    return false;
  }

  const hashParams = getHashParams();
  const searchParams = getSearchParams();
  const nextPath = searchParams.get("next");

  return (
    hashParams.get("type") === "recovery" ||
    searchParams.get("type") === "recovery" ||
    nextPath === "/auth/reset-password" ||
    hashParams.has("access_token") ||
    searchParams.has("code") ||
    hashParams.has("error") ||
    searchParams.has("error")
  );
}

export function getPasswordRecoveryLinkError() {
  if (typeof window === "undefined") {
    return null;
  }

  const hashParams = getHashParams();
  const searchParams = getSearchParams();
  const error = hashParams.get("error") ?? searchParams.get("error");
  const code = hashParams.get("error_code") ?? searchParams.get("error_code");
  const description = hashParams.get("error_description") ?? searchParams.get("error_description");

  if (!error && !code && !description) {
    return null;
  }

  return {
    code,
    description,
    isExpired: code === "otp_expired" || description?.toLowerCase().includes("expired") === true
  };
}

export function getHashParams() {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

export function getSearchParams() {
  return new URLSearchParams(window.location.search);
}

export function getSafeRecoveryNextPath() {
  const nextPath = getSearchParams().get("next") ?? "/auth/reset-password";

  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/auth/reset-password";
  }

  return nextPath;
}
