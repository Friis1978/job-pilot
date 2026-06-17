"use client";

import { useState, useEffect } from "react";

type ToastItem = { id: number; message: string; type: "error" | "success" | "warning" | "info" };

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function handler(e: Event) {
      const { message, type } = (e as CustomEvent<{ message: string; type: "error" | "success" | "warning" | "info" }>).detail;
      const id = Date.now();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        5000,
      );
    }
    window.addEventListener("app:toast", handler);
    return () => window.removeEventListener("app:toast", handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium max-w-sm pointer-events-auto ${
            t.type === "error"
              ? "bg-surface border-error text-error"
              : t.type === "warning"
              ? "bg-surface border-warning text-warning"
              : t.type === "info"
              ? "bg-surface border-info text-info-foreground"
              : "bg-surface border-success text-success-foreground"
          }`}
        >
          {t.type === "error" ? (
            <ErrorIcon className="w-4 h-4 shrink-0 mt-0.5" />
          ) : t.type === "warning" ? (
            <WarningIcon className="w-4 h-4 shrink-0 mt-0.5" />
          ) : t.type === "info" ? (
            <InfoIcon className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <CheckIcon className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 9a.75.75 0 01-.75-.75V10a.75.75 0 011.5 0v4.25A.75.75 0 0110 15z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}
