import { companyKey } from "./extraction";

export type DirectoryAts = {
  provider: "greenhouse" | "lever" | "ashby";
  token: string;
};

export type DirectoryCompany = {
  name: string;
  domain: string;
  industry: string;
  location: string;
  aliases?: string[];
  ats?: DirectoryAts;
};

/**
 * A small, hand-checked directory of publicly known companies. It exists for one
 * reason: news and job feeds often omit the employer's industry and India
 * location, and guessing those from a headline is what made results look
 * unrelated. When a domain or company name matches here we can attach a verified
 * industry and primary India location instead of inventing one.
 *
 * Only public, widely reported facts are stored. Headcount is deliberately not
 * included unless it comes from the company itself, so nothing is fabricated.
 */
export const COMPANY_DIRECTORY: DirectoryCompany[] = [
  // Fintech
  { name: "Razorpay", domain: "razorpay.com", industry: "Fintech", location: "Bengaluru, India", aliases: ["razorpay software"], ats: { provider: "greenhouse", token: "razorpaysoftwareprivatelimited" } },
  { name: "CRED", domain: "cred.club", industry: "Fintech", location: "Bengaluru, India", aliases: ["cred club"], ats: { provider: "lever", token: "cred" } },
  { name: "Groww", domain: "groww.in", industry: "Fintech", location: "Bengaluru, India", ats: { provider: "greenhouse", token: "groww" } },
  { name: "PhonePe", domain: "phonepe.com", industry: "Fintech", location: "Bengaluru, India" },
  { name: "Paytm", domain: "paytm.com", industry: "Fintech", location: "Noida, India", aliases: ["one97 communications"] },
  { name: "Zerodha", domain: "zerodha.com", industry: "Fintech", location: "Bengaluru, India" },

  // E-commerce and consumer marketplaces
  { name: "Meesho", domain: "meesho.com", industry: "E-commerce", location: "Bengaluru, India", ats: { provider: "lever", token: "meesho" } },
  { name: "Flipkart", domain: "flipkart.com", industry: "E-commerce", location: "Bengaluru, India" },
  { name: "Swiggy", domain: "swiggy.com", industry: "E-commerce", location: "Bengaluru, India" },
  { name: "Zepto", domain: "zepto.co", industry: "E-commerce", location: "Mumbai, India" },
  { name: "Nykaa", domain: "nykaa.com", industry: "E-commerce", location: "Mumbai, India", aliases: ["fsn e-commerce"] },
  { name: "Cars24", domain: "cars24.com", industry: "E-commerce", location: "Gurugram, India" },
  { name: "Urban Company", domain: "urbancompany.com", industry: "E-commerce", location: "Gurugram, India", aliases: ["urbanclap"] },
  { name: "Lenskart", domain: "lenskart.com", industry: "Retail", location: "Gurugram, India" },

  // Logistics
  { name: "Delhivery", domain: "delhivery.com", industry: "Logistics", location: "Gurugram, India" },
  { name: "Shiprocket", domain: "shiprocket.in", industry: "Logistics", location: "New Delhi, India" },
  { name: "Ninjacart", domain: "ninjacart.com", industry: "Logistics", location: "Bengaluru, India" },

  // Software and developer tools
  { name: "Zoho", domain: "zoho.com", industry: "B2B SaaS", location: "Chennai, India", aliases: ["zoho corporation"] },
  { name: "Freshworks", domain: "freshworks.com", industry: "B2B SaaS", location: "Chennai, India" },
  { name: "Mindtickle", domain: "mindtickle.com", industry: "B2B SaaS", location: "Pune, India", ats: { provider: "lever", token: "mindtickle" } },
  { name: "Postman", domain: "postman.com", industry: "Developer tools", location: "Bengaluru, India" },
  { name: "Hasura", domain: "hasura.io", industry: "Developer tools", location: "Bengaluru, India" },
  { name: "BrowserStack", domain: "browserstack.com", industry: "Developer tools", location: "Mumbai, India" },
  { name: "Atlan", domain: "atlan.com", industry: "Developer tools", location: "New Delhi, India", ats: { provider: "ashby", token: "atlan" } },
  { name: "Druva", domain: "druva.com", industry: "Cybersecurity", location: "Pune, India", ats: { provider: "greenhouse", token: "druva" } },
  { name: "Innovaccer", domain: "innovaccer.com", industry: "Healthtech", location: "Noida, India" },

  // Marketing and HR technology
  { name: "CleverTap", domain: "clevertap.com", industry: "Marketing technology", location: "Mumbai, India" },
  { name: "MoEngage", domain: "moengage.com", industry: "Marketing technology", location: "Bengaluru, India" },
  { name: "Wingify", domain: "wingify.com", industry: "Marketing technology", location: "New Delhi, India", aliases: ["vwo"] },
  { name: "Darwinbox", domain: "darwinbox.com", industry: "HR technology", location: "Hyderabad, India" },
  { name: "Keka", domain: "keka.com", industry: "HR technology", location: "Hyderabad, India" },

  // Education, health, travel and manufacturing
  { name: "Unacademy", domain: "unacademy.com", industry: "Education", location: "Bengaluru, India" },
  { name: "Vedantu", domain: "vedantu.com", industry: "Education", location: "Bengaluru, India" },
  { name: "Practo", domain: "practo.com", industry: "Healthtech", location: "Bengaluru, India" },
  { name: "Cult.fit", domain: "cult.fit", industry: "Healthtech", location: "Bengaluru, India", aliases: ["curefit", "cultfit"] },
  { name: "MakeMyTrip", domain: "makemytrip.com", industry: "Travel & hospitality", location: "Gurugram, India" },
  { name: "OYO", domain: "oyorooms.com", industry: "Travel & hospitality", location: "Gurugram, India", aliases: ["oyo rooms"] },
  { name: "Zetwerk", domain: "zetwerk.com", industry: "Manufacturing", location: "Bengaluru, India" },
];

function cleanDomain(value: string): string {
  return value.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
}

const BY_DOMAIN = new Map<string, DirectoryCompany>();
const BY_NAME = new Map<string, DirectoryCompany>();

for (const company of COMPANY_DIRECTORY) {
  BY_DOMAIN.set(cleanDomain(company.domain), company);
  for (const name of [company.name, ...(company.aliases ?? [])]) {
    const key = companyKey(name);
    if (key && !BY_NAME.has(key)) BY_NAME.set(key, company);
  }
}

export function directoryCompanyFor(input: { domain?: string | null; name?: string | null }): DirectoryCompany | null {
  const domain = input.domain ? cleanDomain(input.domain) : "";
  if (domain) {
    const byDomain = BY_DOMAIN.get(domain);
    if (byDomain) return byDomain;
  }
  const key = input.name ? companyKey(input.name) : "";
  return key ? BY_NAME.get(key) ?? null : null;
}

export function isIndiaTarget(geographies: string[]): boolean {
  return geographies.some((geography) => /^india$/i.test(geography.trim()));
}

export type WatchlistEntry = {
  domain: string;
  companyName: string;
  industry: string;
  location: string;
  provider?: DirectoryAts["provider"];
  boardToken?: string;
};

/**
 * Picks India directory companies that (a) match the target industry and (b) have
 * a verified public ATS board. Returning only verified boards keeps the watchlist
 * fast and avoids probing dozens of careers pages during a 45-second run.
 */
export function directoryWatchlist(icp: { targetIndustries: string[]; geographies: string[] }, limit = 8): WatchlistEntry[] {
  if (!isIndiaTarget(icp.geographies)) return [];
  const industries = new Set(icp.targetIndustries.map((industry) => industry.trim().toLowerCase()));
  return COMPANY_DIRECTORY.filter(
    (company) => company.ats && industries.has(company.industry.toLowerCase()),
  )
    .slice(0, limit)
    .map((company) => ({
      domain: company.domain,
      companyName: company.name,
      industry: company.industry,
      location: company.location,
      provider: company.ats?.provider,
      boardToken: company.ats?.token,
    }));
}
