import "server-only";
import dns from "node:dns/promises";
import net from "node:net";
import robotsParser from "robots-parser";

const USER_AGENT =
  "BuyingSignalRadarBot/0.1 (+https://github.com/Savarnya1403/buying-signal-radar; polite research bot; respects robots.txt)";
const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 10_000;
const BLOCKED_HOSTS = ["linkedin.com", "www.linkedin.com", "localhost", "metadata.google.internal"];

export class SafeFetchError extends Error {
  code: string;
  status?: number;
  constructor(message: string, code = "FETCH_ERROR", status?: number) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
    this.status = status;
  }
}

export type SafeFetchResult = {
  text: string;
  finalUrl: string;
  status: number;
  contentType: string;
};

export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const parts = address.split(".").map(Number);
    if (parts.some((part) => Number.isNaN(part))) return true;
    if (parts[0] === 0 || parts[0] === 10 || parts[0] === 127) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true;
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) return true;
    if (parts[0] === 255) return true;
    return false;
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized.startsWith("fe80")) return true;
    if (normalized.startsWith("::ffff:")) return isPrivateAddress(normalized.replace("::ffff:", ""));
    return false;
  }
  return true;
}

export async function assertSafeUrl(input: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new SafeFetchError("That does not look like a valid URL.", "INVALID_URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new SafeFetchError("Only public http and https URLs are supported.", "INVALID_PROTOCOL");
  }
  if (url.username || url.password) {
    throw new SafeFetchError("URLs with embedded credentials are not allowed.", "INVALID_URL");
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new SafeFetchError("Only standard web ports are allowed.", "INVALID_PORT");
  }
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
    throw new SafeFetchError(
      hostname.includes("linkedin")
        ? "LinkedIn pages cannot be fetched. Buying Signal Radar never scrapes LinkedIn; store a manual profile URL on a contact instead."
        : "That host is not permitted for automated fetching.",
      "BLOCKED_HOST",
    );
  }
  if (hostname.endsWith(".local") || hostname.endsWith(".internal") || !hostname.includes(".")) {
    if (!net.isIP(hostname)) throw new SafeFetchError("Private or internal hosts are not allowed.", "PRIVATE_HOST");
  }

  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new SafeFetchError("Could not resolve that hostname.", "DNS_ERROR");
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new SafeFetchError("Private or internal IP addresses are not allowed.", "PRIVATE_IP");
  }
  return url;
}

async function readLimited(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new SafeFetchError("Response is larger than the 2 MB limit.", "TOO_LARGE");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export async function safeFetch(
  input: string,
  options: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number; maxRedirects?: number } = {},
): Promise<SafeFetchResult> {
  let current = await assertSafeUrl(input);
  const maxRedirects = options.maxRedirects ?? 3;

  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(current.toString(), {
        method: options.method ?? "GET",
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml,application/json,text/plain;q=0.9,*/*;q=0.5",
          "accept-language": "en",
          ...(options.headers ?? {}),
        },
        body: options.body,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        throw new SafeFetchError("The source took too long to respond (10s timeout).", "TIMEOUT");
      }
      throw new SafeFetchError("Could not reach that source.", "NETWORK_ERROR");
    }
    clearTimeout(timeout);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new SafeFetchError("Source returned a redirect without a destination.", "BAD_REDIRECT", response.status);
      current = await assertSafeUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) {
      throw new SafeFetchError(`Source responded with HTTP ${response.status}.`, "HTTP_ERROR", response.status);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const text = await readLimited(response);
    return { text, finalUrl: current.toString(), status: response.status, contentType };
  }

  throw new SafeFetchError("Too many redirects.", "TOO_MANY_REDIRECTS");
}

export async function robotsAllows(url: string): Promise<{ allowed: boolean; crawlDelay: number; reason: string }> {
  const parsed = new URL(url);
  const robotsUrl = `${parsed.origin}/robots.txt`;
  try {
    const result = await safeFetch(robotsUrl, { timeoutMs: 6000, maxRedirects: 2 });
    const robots = robotsParser(robotsUrl, result.text);
    const allowed = robots.isAllowed(url, USER_AGENT) ?? true;
    const crawlDelay = robots.getCrawlDelay(USER_AGENT) ?? 0;
    return {
      allowed,
      crawlDelay: Math.min(2, crawlDelay),
      reason: allowed ? "Allowed by robots.txt." : "Disallowed by robots.txt.",
    };
  } catch (error) {
    if (error instanceof SafeFetchError && (error.status === 401 || error.status === 403)) {
      return { allowed: false, crawlDelay: 0, reason: "robots.txt could not be read (HTTP 401/403); opting out." };
    }
    return { allowed: true, crawlDelay: 0, reason: "No robots.txt restrictions found." };
  }
}

export async function politeSleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 2000)));
}

export { USER_AGENT };
