import { useEffect } from 'react';
import { Toaster } from 'job_pilot';

function ToasterWithToast({ type, message }: { type: string; message: string }) {
  useEffect(() => {
    const ev = new CustomEvent('app:toast', { detail: { message, type } });
    window.dispatchEvent(ev);
  }, []);
  return <Toaster />;
}

export function SuccessToast() {
  return <ToasterWithToast type="success" message="Profile saved successfully." />;
}

export function ErrorToast() {
  return <ToasterWithToast type="error" message="Failed to update status. Please try again." />;
}

export function WarningToast() {
  return <ToasterWithToast type="warning" message="2 jobs were skipped — no direct apply link available." />;
}

export function InfoToast() {
  return <ToasterWithToast type="info" message="No matching jobs found. Try a different title or lower the minimum match score." />;
}
