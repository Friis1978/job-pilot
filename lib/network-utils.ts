import type { Connection } from "@/types";

const RECRUITER_KEYWORDS = [
  "recruiter",
  "recruiting",
  "talent acquisition",
  "talent partner",
  "headhunter",
  "hiring manager",
  "sourcer",
  "sourcing",
  " ta ",
  "hr ",
  "human resources",
];

const MANAGER_KEYWORDS = [
  "manager",
  "director",
  " vp ",
  "vice president",
  "head of",
  " cto",
  " ceo",
  " coo",
  " cpo",
  "principal",
  "staff ",
  "engineering lead",
  "tech lead",
];

export function isRecruiter(connection: Connection): boolean {
  const pos = connection.position.toLowerCase();
  return RECRUITER_KEYWORDS.some((kw) => pos.includes(kw));
}

export function isManager(connection: Connection): boolean {
  const pos = connection.position.toLowerCase();
  return !isRecruiter(connection) && MANAGER_KEYWORDS.some((kw) => pos.includes(kw));
}

export function calculateOpportunityScore(
  matchScore: number,
  connections: Connection[],
): number {
  if (connections.length === 0) return matchScore;

  let bonus = 10;
  if (connections.some(isRecruiter)) bonus += 15;
  const extra = Math.min(connections.length - 1, 3) * 5;
  bonus += extra;

  return Math.min(matchScore + bonus, 100);
}

export function networkStrength(connections: Connection[]): "none" | "weak" | "moderate" | "strong" {
  if (connections.length === 0) return "none";
  const hasRecruiter = connections.some(isRecruiter);
  if (hasRecruiter || connections.length >= 3) return "strong";
  if (connections.length === 2) return "moderate";
  return "weak";
}

export function buildConnectionMap(connections: Connection[]): Map<string, Connection[]> {
  const map = new Map<string, Connection[]>();
  for (const c of connections) {
    const key = c.company.toLowerCase().trim();
    if (!key) continue;
    const existing = map.get(key) ?? [];
    existing.push(c);
    map.set(key, existing);
  }
  return map;
}

export function getConnectionsForCompany(
  company: string,
  connectionMap: Map<string, Connection[]>,
): Connection[] {
  return connectionMap.get(company.toLowerCase().trim()) ?? [];
}
