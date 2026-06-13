import type { WorkExperience } from "@/types";

export const MATCH_THRESHOLD = 50;

export function computeSkillYears(
  workExperience: WorkExperience[] | null | undefined,
): Record<string, number> {
  const skillYears: Record<string, number> = {};
  for (const role of workExperience ?? []) {
    if (!role.skills?.length) continue;
    const start = role.startDate ? new Date(role.startDate + "-01") : null;
    if (!start || isNaN(start.getTime())) continue;
    const end = role.currentlyWorking
      ? new Date()
      : role.endDate
        ? new Date(role.endDate + "-01")
        : null;
    if (!end || isNaN(end.getTime())) continue;
    const years =
      Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    for (const skill of role.skills) {
      skillYears[skill] = (skillYears[skill] ?? 0) + years;
    }
  }
  return Object.fromEntries(
    Object.entries(skillYears).map(([k, v]) => [k, Math.floor(v)]),
  );
}

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
