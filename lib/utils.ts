import type { WorkExperience } from "@/types";

export const MATCH_THRESHOLD = 70;

/**
 * Job aggregators (Careerjet in particular) return a truncated snippet rather
 * than the posting, and the page behind it is usually bot-protected — so the
 * requirements that would disqualify a candidate are simply absent. Scoring one
 * of those is guesswork: a graduate-only role scored 80 for a 10-year candidate
 * purely because the "newly graduated" requirement was truncated away.
 *
 * Descriptions shorter than this are treated as low-information, and their
 * match score is capped. The scoring prompt states the same rule, but GPT-4o
 * ignored it often enough (46 of 60 snippet jobs scored above the cap, one at
 * 91) that it has to be enforced in code.
 */
export const LOW_INFO_WORD_COUNT = 100;
export const LOW_INFO_SCORE_CAP = 50;

/** Counts whitespace-separated words. Mirrors jobs.description_word_count. */
export function countWords(text: string | null | undefined): number {
  const trimmed = text?.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** True when a posting is too short to justify a confident match score. */
export function isLowInformation(wordCountOrText: number | string | null | undefined): boolean {
  const words = typeof wordCountOrText === "number" ? wordCountOrText : countWords(wordCountOrText);
  return words < LOW_INFO_WORD_COUNT;
}

/** Fixed exchange rates to DKK (EUR pegged by ECB; others approximate). */
export const CURRENCY_TO_DKK: Record<string, number> = {
  EUR: 7.46,
  USD: 6.80,
  GBP: 8.50,
  SEK: 0.65,
  NOK: 0.67,
};

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

const CITY_COUNTRY_DEFAULTS: Record<string, string> = {
  "Copenhagen":    "Denmark",
  "Aarhus":        "Denmark",
  "Odense":        "Denmark",
  "Aalborg":       "Denmark",
  "Frederiksberg": "Denmark",
  "Roskilde":      "Denmark",
  "Kolding":       "Denmark",
  "Esbjerg":       "Denmark",
  "Elsinore":      "Denmark",
  "Helsingør":     "Denmark",
};

const CITY_SUFFIXES = [
  " Metropolitan Area",
  " Metro Area",
  " Municipality",
  " County",
  " Province",
  " District",
  " Region",
];

const CITY_PREFIXES = ["Greater ", "City of "];

const REGION_SEGMENT = /\b(region|municipality|metropolitan|metro|capital|prefecture|area)\b/i;

/**
 * Collapses verbose location strings to "City, Country" form.
 * Strips geographic suffixes/prefixes ("Metropolitan Area", "Municipality", etc.),
 * drops intermediate region segments, and normalises city names to English.
 * Examples:
 *   "Copenhagen Municipality, Capital Region of Denmark, Denmark" → "Copenhagen, Denmark"
 *   "Copenhagen Metropolitan Area" → "Copenhagen"
 *   "København, Denmark" → "Copenhagen, Denmark"
 */
export function shortenLocation(location: string | null | undefined): string | null {
  if (!location) return location ?? null;

  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;

  let city = parts[0];

  for (const suffix of CITY_SUFFIXES) {
    if (city.toLowerCase().endsWith(suffix.toLowerCase())) {
      city = city.slice(0, -suffix.length).trim();
      break;
    }
  }
  for (const prefix of CITY_PREFIXES) {
    if (city.toLowerCase().startsWith(prefix.toLowerCase())) {
      city = city.slice(prefix.length).trim();
      break;
    }
  }

  city = LOCATION_TO_ENGLISH[city.toLowerCase()] ?? city;

  const last = parts.length > 1 ? parts[parts.length - 1] : null;
  const country = (last && !REGION_SEGMENT.test(last) ? last : null)
    ?? CITY_COUNTRY_DEFAULTS[city]
    ?? null;

  return country ? `${city}, ${country}` : city;
}

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

/**
 * Computes total career span in years as the distance between the earliest
 * start date and the latest end date across all work experience entries.
 * Concurrent roles are NOT double-counted.
 */
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

/**
 * Accumulates years of experience per skill across work history and any extra
 * periods (e.g. personal projects). Overlapping periods are additive.
 * @param extraPeriods Additional dated skill periods to include alongside work experience.
 * @returns Map of skill name → floored years of usage.
 */
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

/**
 * Strips HTML tags and decodes entities to produce readable plain text.
 * Block-level tags (p, div, li, h1–h6, etc.) become newlines so paragraph
 * structure is preserved. Collapses runs of 3+ blank lines down to 2.
 */
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

/** Converts an ISO date string to a human-readable relative label ("Just now", "3 hours ago", "Yesterday", etc.). */
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
