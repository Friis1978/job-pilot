export const MATCH_THRESHOLD = 50;

export function stripHtml(html: string): string {
  return html
    // Block-level tags → newline so paragraphs stay readable
    .replace(/<\/(p|div|li|br|h[1-6]|tr|td|th)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Strip all remaining tags
    .replace(/<[^>]+>/g, "")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    // Collapse 3+ newlines to 2, trim each line, strip leading/trailing whitespace
    .split("\n")
    .map((l) => l.trim())
    .filter((l, i, arr) => l !== "" || (arr[i - 1] !== "" && arr[i + 1] !== ""))
    .join("\n")
    .trim();
}

export function formatDateAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return minutes <= 1 ? "Just now" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}
