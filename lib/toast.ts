/**
 * Fires an `app:toast` DOM event consumed by the global toast listener.
 * No-ops during SSR (when `window` is unavailable).
 */
export function toast(message: string, type: "error" | "success" | "warning" | "info" = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("app:toast", { detail: { message, type } }),
  );
}
