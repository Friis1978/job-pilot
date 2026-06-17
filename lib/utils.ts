import type { WorkExperience } from "@/types";

export const MATCH_THRESHOLD = 70;

// Maps common city names to all recognised variants (English + local language).
// Used to run parallel searches on APIs that only accept one form at a time.
const LOCATION_ALIASES: Record<string, string[]> = {
  copenhagen:    ["Copenhagen", "København"],
  københavn:     ["Copenhagen", "København"],
  aarhus:        ["Aarhus", "Århus"],
  århus:         ["Aarhus", "Århus"],
  odense:        ["Odense"],
  aalborg:       ["Aalborg"],
  "helsingør":   ["Helsingør", "Elsinore"],
  elsinore:      ["Helsingør", "Elsinore"],
  roskilde:      ["Roskilde"],
  frederiksberg: ["Frederiksberg"],
  kolding:       ["Kolding"],
  esbjerg:       ["Esbjerg"],
  denmark:       ["Denmark", "Danmark"],
  danmark:       ["Denmark", "Danmark"],
};

/**
 * Returns all known location variants for a given input (e.g. both the English
 * and Danish name for the same city). Falls back to `[location]` if unknown.
 */
export function getLocationAliases(location: string): string[] {
  return LOCATION_ALIASES[location.toLowerCase().trim()] ?? [location];
}

// Maps non-English location terms to their canonical English form.
// Applied to job locations before saving to DB.
const LOCATION_TO_ENGLISH: Record<string, string> = {
  "københavn":    "Copenhagen",
  "kbh":          "Copenhagen",
  "kbh.":         "Copenhagen",
  "århus":        "Aarhus",
  "helsingør":    "Elsinore",
  "sønderjylland":"South Jutland",
  "midtjylland":  "Central Jutland",
  "nordjylland":  "North Jutland",
  "sjælland":     "Zealand",
  "fyn":          "Funen",
  "bornholm":     "Bornholm",
  "danmark":      "Denmark",
};

/**
 * Translates non-English location names to English.
 * Handles full strings like "København, Denmark" and partial matches within
 * comma-separated segments (e.g. "Østerbro, København" → "Østerbro, Copenhagen").
 */
export function normalizeLocationToEnglish(location: string | null | undefined): string | null {
  if (!location) return location ?? null;
  return location
    .split(",")
    .map((segment) => {
      const trimmed = segment.trim();
      const english = LOCATION_TO_ENGLISH[trimmed.toLowerCase()];
      return english ?? trimmed;
    })
    .join(", ");
}

export function computeTotalYearsExperience(
  workExperience: WorkExperience[] | null | undefined,
): number {
  const entries = workExperience ?? [];
  if (!entries.length) return 0;

  let earliest: Date | null = null;
  let latest: Date | null = null;

  for (const role of entries) {
    const start = role.startDate ? new Date(role.startDate + "-01") : null;
    if (start && !isNaN(start.getTime())) {
      if (!earliest || start < earliest) earliest = start;
    }
    const end = role.currentlyWorking
      ? new Date()
      : role.endDate
        ? new Date(role.endDate + "-01")
        : null;
    if (end && !isNaN(end.getTime())) {
      if (!latest || end > latest) latest = end;
    }
  }

  if (!earliest || !latest) return 0;
  return Math.max(
    0,
    Math.floor((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 365.25)),
  );
}

type SkillPeriod = {
  startDate?: string;
  endDate?: string;
  currentlyWorking?: boolean;
  skills?: string[];
};

export function computeSkillYears(
  workExperience: WorkExperience[] | null | undefined,
  extraPeriods?: SkillPeriod[] | null,
): Record<string, number> {
  const skillYears: Record<string, number> = {};
  const all: SkillPeriod[] = [...(workExperience ?? []), ...(extraPeriods ?? [])];
  for (const entry of all) {
    if (!entry.skills?.length) continue;
    const start = entry.startDate ? new Date(entry.startDate + "-01") : null;
    if (!start || isNaN(start.getTime())) continue;
    const end = entry.currentlyWorking
      ? new Date()
      : entry.endDate
        ? new Date(entry.endDate + "-01")
        : null;
    if (!end || isNaN(end.getTime())) continue;
    const years =
      Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    for (const skill of entry.skills) {
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
