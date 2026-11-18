export type TaxonomyEntry = {
  label: string;
  aliases: string[];
};

export const INDUSTRIES: TaxonomyEntry[] = [
  { label: "B2B SaaS", aliases: ["b2b saas", "b2b software", "saas", "software as a service", "vertical saas"] },
  { label: "Fintech", aliases: ["fintech", "financial technology", "payments", "banking", "lending", "neobank", "wealth management"] },
  { label: "Developer tools", aliases: ["developer tools", "devtools", "dev tools", "developer platform", "api platform", "observability", "devops", "infrastructure software"] },
  { label: "Healthtech", aliases: ["healthtech", "health tech", "healthcare", "digital health", "medical", "clinical", "patient care"] },
  { label: "E-commerce", aliases: ["ecommerce", "e-commerce", "online retail", "d2c", "direct-to-consumer", "shopify", "marketplace sellers"] },
  { label: "Logistics", aliases: ["logistics", "supply chain", "freight", "shipping", "fulfilment", "fulfillment", "last mile"] },
  { label: "Cybersecurity", aliases: ["cybersecurity", "cyber security", "security software", "infosec", "appsec", "identity security"] },
  { label: "AI / ML", aliases: ["artificial intelligence", "machine learning", "ai/ml", "ai company", "generative ai", "ai agents", "llm"] },
  { label: "Climate tech", aliases: ["climate tech", "climatech", "cleantech", "sustainability", "carbon", "renewable energy"] },
  { label: "Manufacturing", aliases: ["manufacturing", "industrial", "factory", "factories", "production line"] },
  { label: "Professional services", aliases: ["professional services", "consultancy", "consulting", "accounting firm", "law firm", "legal services"] },
  { label: "Marketing technology", aliases: ["martech", "marketing technology", "marketing automation", "adtech", "advertising technology"] },
  { label: "HR technology", aliases: ["hr tech", "hris", "people operations", "recruiting software", "talent management", "payroll"] },
  { label: "Real estate", aliases: ["real estate", "proptech", "property management", "realty"] },
  { label: "Education", aliases: ["edtech", "education technology", "education", "learning platform", "schools", "universities"] },
  { label: "Travel & hospitality", aliases: ["travel", "hospitality", "hotels", "restaurants", "food service", "tourism"] },
  { label: "Media & entertainment", aliases: ["media", "entertainment", "publishing", "streaming", "gaming", "creator economy"] },
  { label: "Legal technology", aliases: ["legaltech", "legal tech", "contract management", "e-discovery"] },
  { label: "Insurtech", aliases: ["insurtech", "insurance", "underwriting", "claims"] },
  { label: "Marketplaces", aliases: ["marketplace", "two-sided marketplace", "platform marketplace"] },
  { label: "Retail", aliases: ["retail", "consumer brands", "cpg", "brick and mortar"] },
  { label: "Consumer goods", aliases: ["consumer goods", "consumer products", "fmcg"] },
  { label: "Nonprofits", aliases: ["nonprofit", "non-profit", "charity", "ngo"] },
  { label: "Construction", aliases: ["construction", "proptech construction", "contractors", "building"] },
  { label: "Energy", aliases: ["energy", "utilities", "oil and gas", "solar", "grid"] },
  { label: "Automotive", aliases: ["automotive", "mobility", "ev", "electric vehicle", "fleet"] },
  { label: "Telecom", aliases: ["telecom", "telecommunications", "isp", "mobile network"] },
  { label: "Biotech", aliases: ["biotech", "life sciences", "pharma", "pharmaceutical", "genomics"] },
  { label: "Agencies", aliases: ["agencies", "creative agency", "marketing agency", "digital agency"] },
  { label: "Customer support", aliases: ["customer support", "customer service", "contact centre", "contact center", "helpdesk"] },
];

export const BUYER_ROLES: TaxonomyEntry[] = [
  { label: "Founder / CEO", aliases: ["founder", "founders", "ceo", "chief executive", "co-founder", "cofounder", "owner", "managing director"] },
  { label: "VP Sales / Sales leadership", aliases: ["vp sales", "head of sales", "sales leader", "sales leadership", "cro", "chief revenue officer", "sales director", "sales team", "sales teams", "sales org"] },
  { label: "Revenue Operations", aliases: ["revops", "revenue operations", "sales operations", "sales ops", "revenue ops"] },
  { label: "Head of Growth / Marketing", aliases: ["head of growth", "growth team", "marketing leader", "cmo", "vp marketing", "head of marketing", "growth", "marketing teams", "demand generation"] },
  { label: "CTO / VP Engineering", aliases: ["cto", "vp engineering", "head of engineering", "engineering leader", "technical founder", "chief technology officer", "engineering teams"] },
  { label: "Product leadership", aliases: ["head of product", "vp product", "cpo", "product leader", "product teams", "product managers"] },
  { label: "Customer Success", aliases: ["customer success", "head of cs", "vp customer success", "account management"] },
  { label: "Finance leadership", aliases: ["cfo", "finance leader", "vp finance", "head of finance", "finance teams", "financial controller"] },
  { label: "People / HR", aliases: ["chro", "head of people", "hr leader", "vp people", "people teams", "hr teams", "talent acquisition"] },
  { label: "Operations", aliases: ["coo", "head of operations", "operations leader", "ops teams", "operations teams"] },
  { label: "Security leadership", aliases: ["ciso", "head of security", "security leader", "vp security"] },
  { label: "Data leadership", aliases: ["head of data", "data leader", "chief data officer", "analytics leader", "data teams"] },
  { label: "IT leadership", aliases: ["cio", "head of it", "it leader", "vp it", "it teams"] },
];

export const GEOGRAPHIES: TaxonomyEntry[] = [  { label: "United States", aliases: ["united states", "u.s.", "u.s.a", "usa", "us-based", "america", "american", "new york", "san francisco", "bay area", "austin", "boston", "seattle", "los angeles", "chicago", "miami", "denver", "atlanta", "washington dc"] },
  { label: "United Kingdom", aliases: ["united kingdom", "u.k.", "uk", "britain", "british", "england", "scotland", "wales"] },
  { label: "Canada", aliases: ["canada", "canadian", "toronto", "vancouver", "montreal"] },
  { label: "Germany", aliases: ["germany", "german", "berlin", "munich", "hamburg"] },
  { label: "France", aliases: ["france", "french", "paris", "lyon"] },
  { label: "Netherlands", aliases: ["netherlands", "dutch", "amsterdam", "rotterdam"] },
  { label: "Spain", aliases: ["spain", "spanish", "madrid", "barcelona"] },
  { label: "Portugal", aliases: ["portugal", "lisbon", "porto"] },
  { label: "Ireland", aliases: ["ireland", "irish", "dublin"] },
  { label: "Sweden", aliases: ["sweden", "swedish", "stockholm"] },
  { label: "Denmark", aliases: ["denmark", "danish", "copenhagen"] },
  { label: "Norway", aliases: ["norway", "oslo"] },
  { label: "Finland", aliases: ["finland", "helsinki"] },
  { label: "Switzerland", aliases: ["switzerland", "swiss", "zurich", "geneva"] },
  { label: "Israel", aliases: ["israel", "tel aviv", "israeli"] },
  { label: "India", aliases: ["india", "indian", "bangalore", "bengaluru", "mumbai", "delhi", "hyderabad", "pune", "chennai"] },
  { label: "Singapore", aliases: ["singapore", "singaporean"] },
  { label: "Australia", aliases: ["australia", "australian", "sydney", "melbourne"] },
  { label: "New Zealand", aliases: ["new zealand", "auckland"] },
  { label: "Japan", aliases: ["japan", "japanese", "tokyo", "osaka"] },
  { label: "South Korea", aliases: ["south korea", "seoul", "korean"] },
  { label: "China", aliases: ["china", "chinese", "shanghai", "beijing", "shenzhen"] },
  { label: "Brazil", aliases: ["brazil", "brazilian", "são paulo", "sao paulo", "rio de janeiro"] },
  { label: "Mexico", aliases: ["mexico", "mexican", "mexico city", "cdmx"] },
  { label: "United Arab Emirates", aliases: ["uae", "united arab emirates", "dubai", "abu dhabi"] },
  { label: "South Africa", aliases: ["south africa", "cape town", "johannesburg"] },
  { label: "Nigeria", aliases: ["nigeria", "lagos"] },
  { label: "Kenya", aliases: ["kenya", "nairobi"] },
  { label: "Poland", aliases: ["poland", "warsaw", "krakow"] },
  { label: "Czech Republic", aliases: ["czech republic", "czechia", "prague"] },
  { label: "Austria", aliases: ["austria", "vienna"] },
  { label: "Belgium", aliases: ["belgium", "brussels"] },
  { label: "Italy", aliases: ["italy", "italian", "milan", "rome"] },
  { label: "Europe", aliases: ["europe", "european", "eu", "european union"] },
  { label: "North America", aliases: ["north america", "north american"] },
  { label: "Latin America", aliases: ["latin america", "latam", "south america", "central america"] },
  { label: "Asia Pacific", aliases: ["asia pacific", "apac", "asia-pacific"] },
  { label: "Middle East", aliases: ["middle east", "mena"] },
  { label: "Africa", aliases: ["africa", "african"] },
  { label: "Remote / global", aliases: ["remote", "globally", "global", "worldwide", "anywhere"] },
];

/**
 * Countries covered by a broad region. Used so a source tagged "Europe" still
 * matches a "United Kingdom" target, and a "Germany" company still counts for a
 * "Europe" target. It is deliberately one level deep, not a geo database.
 */
export const REGION_MEMBERS: Record<string, string[]> = {
  Europe: [
    "United Kingdom", "Germany", "France", "Netherlands", "Spain", "Portugal", "Ireland", "Sweden",
    "Denmark", "Norway", "Finland", "Switzerland", "Poland", "Czech Republic", "Austria", "Belgium", "Italy",
  ],
  "North America": ["United States", "Canada", "Mexico"],
  "Latin America": ["Brazil", "Mexico"],
  "Asia Pacific": ["India", "Singapore", "Australia", "New Zealand", "Japan", "South Korea", "China"],
  "Middle East": ["United Arab Emirates", "Israel"],
  Africa: ["South Africa", "Nigeria", "Kenya"],
};

export function regionCovers(region: string, geography: string): boolean {
  return Boolean(REGION_MEMBERS[region]?.some((member) => member.toLowerCase() === geography.toLowerCase()));
}

export const PAIN_POINTS: TaxonomyEntry[] = [
  { label: "Pipeline forecasting", aliases: ["pipeline forecast", "forecast pipeline", "sales forecast", "revenue forecast", "forecasting", "predictable revenue"] },
  { label: "CRM administration", aliases: ["crm admin", "crm administration", "data entry", "crm hygiene", "salesforce admin", "deal desk admin"] },
  { label: "Churn and retention", aliases: ["churn", "retention", "renewals", "at-risk customers", "customer attrition"] },
  { label: "Lead generation", aliases: ["lead generation", "lead gen", "pipeline generation", "prospecting", "demand generation", "book more meetings"] },
  { label: "Long sales cycles", aliases: ["sales cycle", "slow sales", "deal velocity", "close deals faster", "long procurement"] },
  { label: "Manual reporting", aliases: ["manual reporting", "spreadsheets", "manual reports", "reporting burden", "board reporting"] },
  { label: "Data quality", aliases: ["data quality", "dirty data", "duplicate records", "data hygiene", "inaccurate data"] },
  { label: "Customer support volume", aliases: ["support volume", "ticket volume", "support tickets", "customer support costs", "response times"] },
  { label: "Cloud costs", aliases: ["cloud costs", "cloud spend", "infrastructure costs", "aws bill", "cost optimisation", "cost optimization"] },
  { label: "Compliance burden", aliases: ["compliance", "soc 2", "gdpr", "audit preparation", "regulatory burden", "kyc"] },
  { label: "Security risk", aliases: ["security risk", "vulnerabilities", "threat detection", "security incidents", "phishing"] },
  { label: "Inventory planning", aliases: ["inventory", "stockouts", "demand planning", "warehouse planning"] },
  { label: "Payment friction", aliases: ["payment friction", "failed payments", "checkout conversion", "payment costs", "billing issues"] },
  { label: "Onboarding time", aliases: ["onboarding time", "time to value", "ramp time", "new hire ramp", "implementation time"] },
  { label: "Developer productivity", aliases: ["developer productivity", "developer experience", "deployment speed", "engineering velocity", "tooling sprawl"] },
  { label: "Marketing attribution", aliases: ["attribution", "marketing roi", "channel performance", "campaign reporting"] },
  { label: "Pricing strategy", aliases: ["pricing", "packaging", "discounting", "price optimisation", "price optimization"] },
  { label: "Capacity planning", aliases: ["capacity planning", "resource planning", "staffing", "workload balancing"] },
  { label: "Fragmented tooling", aliases: ["tool sprawl", "fragmented tools", "too many tools", "disconnected systems", "point solutions"] },
  { label: "Slow deployments", aliases: ["slow deployments", "release process", "ci/cd", "deployment bottlenecks"] },
  { label: "Document processing", aliases: ["document processing", "paperwork", "contract review", "invoice processing", "data extraction"] },
  { label: "Scheduling", aliases: ["scheduling", "calendar chaos", "shift planning", "booking"] },
  { label: "Employee retention", aliases: ["employee retention", "attrition", "engagement", "burnout"] },
  { label: "Cash flow visibility", aliases: ["cash flow", "runway", "burn rate", "financial visibility", "budgeting"] },
  { label: "Data silos", aliases: ["data silos", "siloed data", "single source of truth", "data integration", "etl"] },
  { label: "Customer acquisition cost", aliases: ["customer acquisition cost", "cac", "acquisition costs", "paid acquisition"] },
  { label: "Contract management", aliases: ["contract management", "contract lifecycle", "renewal management", "legal review"] },
  { label: "Hiring and onboarding", aliases: ["hiring", "recruiting", "talent acquisition", "onboarding", "headcount planning"] },
  { label: "Fraud and risk", aliases: ["fraud", "risk management", "chargebacks", "aml", "fraud detection"] },
  { label: "Localisation", aliases: ["localisation", "localization", "multi-language", "international payments", "currency"] },
];

export const BUYING_TRIGGERS: TaxonomyEntry[] = [
  { label: "Hiring", aliases: ["hiring", "new roles", "headcount", "recruiting", "job postings", "scaling the team", "open roles"] },
  { label: "Funding", aliases: ["funding", "raised", "raise", "series a", "series b", "seed round", "investment", "capital"] },
  { label: "Geographic expansion", aliases: ["expansion", "expanding", "new market", "new region", "opening an office", "international", "going global", "launching in"] },
  { label: "Product launches", aliases: ["product launch", "launches", "launching", "new product", "release", "general availability", "ga"] },
  { label: "Technology changes", aliases: ["technology change", "migration", "migrating", "switching", "replatform", "modernisation", "modernization", "new stack"] },
  { label: "Strategic partnerships", aliases: ["partnership", "partners with", "partnering", "integration", "alliance", "reseller"] },
  { label: "Leadership changes", aliases: ["leadership change", "new ceo", "new cto", "new cro", "appointment", "joins as", "appointed", "new vp"] },
  { label: "Customer growth", aliases: ["customer growth", "customer count", "growing customer base", "arr growth", "adoption", "customer traction"] },
  { label: "Customer complaints", aliases: ["complaints", "customer complaint", "outage", "churn", "backlash", "dissatisfaction", "downtime"] },
];

export const TRIGGER_TO_SIGNAL: Record<string, string> = {
  Hiring: "HIRING",
  Funding: "FUNDING",
  "Geographic expansion": "EXPANSION",
  "Product launches": "PRODUCT_LAUNCH",
  "Technology changes": "TECHNOLOGY_CHANGE",
  "Strategic partnerships": "PARTNERSHIP",
  "Leadership changes": "LEADERSHIP",
  "Customer growth": "CUSTOMER_GROWTH",
  "Customer complaints": "CUSTOMER_COMPLAINT",
};

export const PRODUCT_CATEGORIES: TaxonomyEntry[] = [
  { label: "Revenue intelligence", aliases: ["revenue intelligence", "sales intelligence", "pipeline intelligence", "sales forecasting", "revenue operations software", "deal intelligence"] },
  { label: "CRM", aliases: ["crm", "customer relationship management", "sales crm"] },
  { label: "Sales engagement", aliases: ["sales engagement", "outbound platform", "sales outreach", "sequencing tool", "prospecting software"] },
  { label: "Marketing automation", aliases: ["marketing automation", "marketing platform", "campaign management", "email marketing"] },
  { label: "Customer support platform", aliases: ["customer support platform", "helpdesk", "support software", "customer service platform", "ticketing system"] },
  { label: "Observability", aliases: ["observability", "monitoring platform", "apm", "log management", "incident management"] },
  { label: "DevOps platform", aliases: ["devops", "deployment platform", "ci/cd", "developer productivity platform"] },
  { label: "Data platform", aliases: ["data platform", "data pipeline", "etl", "analytics platform", "data warehouse", "business intelligence", "bi tool"] },
  { label: "Cybersecurity platform", aliases: ["security platform", "cybersecurity", "threat detection", "appsec", "identity platform"] },
  { label: "Payments infrastructure", aliases: ["payments infrastructure", "payment platform", "billing platform", "payment processing", "merchant of record"] },
  { label: "HR platform", aliases: ["hr platform", "hris", "people platform", "recruiting platform", "payroll software"] },
  { label: "AI assistant", aliases: ["ai assistant", "ai agent", "copilot", "ai platform", "generative ai"] },
  { label: "Workflow automation", aliases: ["workflow automation", "automation platform", "no-code", "low-code", "process automation"] },
  { label: "Project management", aliases: ["project management", "task management", "collaboration software", "work management"] },
  { label: "E-signature", aliases: ["e-signature", "electronic signature", "document signing"] },
  { label: "Accounting software", aliases: ["accounting software", "bookkeeping", "invoicing software", "finance platform", "expense management"] },
  { label: "Procurement platform", aliases: ["procurement", "spend management", "purchasing software", "vendor management"] },
  { label: "Logistics platform", aliases: ["logistics platform", "freight software", "supply chain platform", "shipping software"] },
  { label: "Healthcare platform", aliases: ["healthcare platform", "clinical software", "ehr", "telehealth", "patient engagement"] },
  { label: "Legal tech", aliases: ["legal tech", "contract software", "legal operations platform"] },
  { label: "Real estate platform", aliases: ["real estate software", "proptech", "property management software"] },
  { label: "E-commerce platform", aliases: ["e-commerce platform", "commerce platform", "shopify app", "retail software"] },
  { label: "Recruiting platform", aliases: ["recruiting software", "applicant tracking", "ats", "talent platform"] },
  { label: "Customer success platform", aliases: ["customer success software", "customer success platform", "renewal management"] },
  { label: "Compliance platform", aliases: ["compliance platform", "soc 2 automation", "governance risk compliance", "grc"] },
];

export const SIZE_PRESETS: Record<string, { min: number | null; max: number | null; label: string }> = {
  startup: { min: 1, max: 50, label: "Startup (1–50)" },
  smb: { min: 1, max: 100, label: "SMB (1–100)" },
  "mid-market": { min: 100, max: 1000, label: "Mid-market (100–1,000)" },
  enterprise: { min: 1000, max: 10000, label: "Enterprise (1,000–10,000)" },
};

export const SAMPLE_PRODUCT_DESCRIPTIONS = [
  {
    label: "Revenue intelligence",
    text: "We sell an AI revenue intelligence platform for B2B SaaS founders and sales teams. It helps them forecast pipeline, reduce CRM admin and spot at-risk deals before renewal. We focus on companies with 20–500 employees in the US, UK and Germany, mainly fintech and developer tools. We do not work with enterprises over 5,000 employees.",
  },
  {
    label: "Compliance automation",
    text: "We build SOC 2 compliance automation software for early-stage B2B SaaS and fintech companies. It helps CTOs and security leads get audit-ready, manage evidence and avoid painful security questionnaires. Ideal customers have 10 to 200 employees across the US, Canada and the UK. We don't target large banks or companies already using a Big Four auditor.",
  },
  {
    label: "India fintech GTM",
    text: "We sell a customer-onboarding and KYC platform to Indian fintech and lending companies. It helps product and compliance teams verify users faster and cut manual review. We want 50 to 2,000 employee companies in India, especially in Bengaluru, Mumbai and Gurugram. We don't work with banks over 10,000 employees.",
  },
  {
    label: "Logistics software",
    text: "Our product is a supply chain visibility platform for mid-market logistics and e-commerce companies. We help operations leaders track shipments, reduce stockouts and plan capacity. We're looking for 100–1,000 employee companies in Europe and North America. Exclude tiny courier businesses under 20 people.",
  },
];
