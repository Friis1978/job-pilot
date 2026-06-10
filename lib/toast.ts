export function toast(message: string, type: "error" | "success" = "error") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("app:toast", { detail: { message, type } }),
  );
}
