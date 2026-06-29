export type ParsedConnection = {
  first_name: string;
  last_name: string;
  linkedin_url: string | null;
  email: string | null;
  company: string;
  position: string;
  connected_on: string | null;
};

const HEADER_FIELDS = ["first name", "last name", "url", "email address", "company", "position", "connected on"];

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function isHeaderRow(fields: string[]): boolean {
  const lowered = fields.map((f) => f.toLowerCase().replace(/^"|"$/g, "").trim());
  return HEADER_FIELDS.every((h) => lowered.includes(h));
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

export function parseLinkedInCSV(text: string): {
  connections: ParsedConnection[];
  errors: string[];
} {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const errors: string[] = [];
  let headerIndex = -1;
  let headerFields: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (isHeaderRow(fields)) {
      headerIndex = i;
      headerFields = fields.map((f) => f.toLowerCase().replace(/^"|"$/g, "").trim());
      break;
    }
  }

  if (headerIndex === -1) {
    return { connections: [], errors: ["Could not find CSV header row. Make sure you are uploading a LinkedIn Connections.csv file."] };
  }

  const col = (name: string) => headerFields.indexOf(name);
  const iFirst = col("first name");
  const iLast = col("last name");
  const iUrl = col("url");
  const iEmail = col("email address");
  const iCompany = col("company");
  const iPosition = col("position");
  const iDate = col("connected on");

  const connections: ParsedConnection[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 4) continue;

    const first_name = fields[iFirst]?.replace(/^"|"$/g, "").trim() ?? "";
    const last_name = fields[iLast]?.replace(/^"|"$/g, "").trim() ?? "";

    if (!first_name && !last_name) continue;

    connections.push({
      first_name,
      last_name,
      linkedin_url: fields[iUrl]?.replace(/^"|"$/g, "").trim() || null,
      email: fields[iEmail]?.replace(/^"|"$/g, "").trim() || null,
      company: fields[iCompany]?.replace(/^"|"$/g, "").trim() ?? "",
      position: fields[iPosition]?.replace(/^"|"$/g, "").trim() ?? "",
      connected_on: parseDate(fields[iDate]?.replace(/^"|"$/g, "").trim() ?? ""),
    });
  }

  if (connections.length === 0) {
    errors.push("No valid connections found in the file.");
  }

  return { connections, errors };
}
