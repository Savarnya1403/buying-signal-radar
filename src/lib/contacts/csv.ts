import Papa from "papaparse";
import { z } from "zod";

export const contactRowSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Invalid email").max(254).optional().or(z.literal("")),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(160).optional().or(z.literal("")),
  relationshipType: z.string().trim().max(60).optional().or(z.literal("")),
  strength: z.number().int().min(1).max(5),
  verified: z.boolean(),
  firstDegree: z.boolean().default(true),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  linkedinUrl: z.string().trim().max(500).optional().or(z.literal("")),
  knows: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type ParsedContact = z.infer<typeof contactRowSchema>;

export type CsvParseResult = {
  rows: ParsedContact[];
  errors: { row: number; message: string }[];
  skipped: number;
  headers: string[];
};

const EMAIL_PROVIDERS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com", "me.com",
  "aol.com", "proton.me", "protonmail.com", "hey.com", "fastmail.com", "mail.com", "gmx.com", "yandex.com",
]);

export function domainFromEmail(email?: string | null): string | null {
  if (!email || !email.includes("@")) return null;
  const domain = email.split("@").pop()?.toLowerCase().trim();
  if (!domain || EMAIL_PROVIDERS.has(domain)) return null;
  return domain;
}

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const match = Object.keys(row).find((candidate) => candidate.trim().toLowerCase().replace(/[\s_-]+/g, "") === key);
    const value = match ? row[match] : undefined;
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function parseStrength(raw: string): number {
  if (!raw) return 3;
  const lower = raw.toLowerCase();
  if (/\b(5|very strong|inner circle|close)\b/.test(lower)) return 5;
  if (/\b(4|strong)\b/.test(lower)) return 4;
  if (/\b(2|weak|loose|distant)\b/.test(lower)) return 2;
  if (/\b(1|unknown|cold)\b/.test(lower)) return 1;
  const number = Number.parseInt(raw, 10);
  if (!Number.isNaN(number)) return Math.min(5, Math.max(1, number));
  return 3;
}

function parseBoolean(raw: string): boolean {
  return /^(true|yes|y|1|verified|confirmed)$/i.test(raw.trim());
}

export function parseContactsCsv(csv: string): CsvParseResult {
  const errors: { row: number; message: string }[] = [];
  const rows: ParsedContact[] = [];
  const parsed = Papa.parse<Record<string, unknown>>(csv.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  for (const parseError of parsed.errors.slice(0, 5)) {
    errors.push({ row: (parseError.row ?? 0) + 2, message: parseError.message });
  }

  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2;
    const raw = {
      name: pick(row, ["name", "fullname", "contactname", "person"]),
      email: pick(row, ["email", "emailaddress", "workemail"]),
      company: pick(row, ["company", "companyname", "organization", "organisation", "employer"]),
      jobTitle: pick(row, ["jobtitle", "title", "role", "position"]),
      relationshipType: pick(row, ["relationshiptype", "relationship", "type"]),
      strength: parseStrength(pick(row, ["relationshipstrength", "strength", "closeness"])),
      verified: parseBoolean(pick(row, ["verified", "isverified", "confirmed"])),
      firstDegree: pick(row, ["firstdegree", "direct", "knowndirectly"]) ? parseBoolean(pick(row, ["firstdegree", "direct", "knowndirectly"])) : true,
      notes: pick(row, ["notes", "note", "context"]),
      linkedinUrl: pick(row, ["linkedinurl", "linkedin", "profileurl"]),
      knows: pick(row, ["knows", "connectedto", "relationships", "introducedby"]),
    };

    if (!raw.name && !raw.email) {
      errors.push({ row: rowNumber, message: "Row has no name or email — skipped." });
      return;
    }
    if (!raw.name && raw.email) raw.name = raw.email.split("@")[0].replace(/[._-]+/g, " ");
    if (raw.linkedinUrl && !/^https?:\/\/(www\.)?linkedin\.com\//i.test(raw.linkedinUrl)) {
      errors.push({ row: rowNumber, message: "LinkedIn URL ignored — only manual linkedin.com profile links are accepted." });
      raw.linkedinUrl = "";
    }

    const result = contactRowSchema.safeParse(raw);
    if (!result.success) {
      errors.push({ row: rowNumber, message: result.error.issues[0]?.message ?? "Invalid row." });
      return;
    }
    rows.push(result.data);
  });

  return {
    rows,
    errors: errors.slice(0, 20),
    skipped: errors.length,
    headers: parsed.meta.fields ?? [],
  };
}

export function contactsCsvTemplate(): string {
  return [
    "name,email,company,job_title,relationship_type,relationship_strength,verified,first_degree,notes,linkedin_url,knows",
    'Alex Morgan,alex@example.com,Northwind Labs,VP Sales,Former colleague,4,true,true,"Worked together at Acme; catches up quarterly",https://www.linkedin.com/in/example-alex,',
    'Priya Shah,priya@example.com,Kestrel Finance,Head of Revenue Operations,Investor intro,3,false,false,"Met at SaaStr 2025 — introduction target, not a direct contact",,Alex Morgan',
  ].join("\n");
}

function sanitizeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(sanitizeCsvCell).join(","), ...rows.map((row) => row.map(sanitizeCsvCell).join(","))].join("\r\n");
}
