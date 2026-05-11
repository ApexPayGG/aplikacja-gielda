import axios from "axios";

const LOCALHOST_MARKERS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"]);

function isPrivateIpv4(ip: string): boolean {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    ip.startsWith("169.254.")
  );
}

function normalizeCandidate(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (v.startsWith("::ffff:")) return v.slice(7);
  return v;
}

export function extractClientIp(input: {
  forwardedFor?: string | string[] | undefined;
  realIp?: string | undefined;
  reqIp?: string | undefined;
  remoteAddress?: string | undefined;
}): string | null {
  const chain: string[] = [];
  const ff = input.forwardedFor;
  if (typeof ff === "string") {
    chain.push(...ff.split(","));
  } else if (Array.isArray(ff)) {
    chain.push(...ff.flatMap((part) => part.split(",")));
  }
  if (input.realIp) chain.push(input.realIp);
  if (input.reqIp) chain.push(input.reqIp);
  if (input.remoteAddress) chain.push(input.remoteAddress);

  for (const candidate of chain) {
    const ip = normalizeCandidate(candidate);
    if (!ip || LOCALHOST_MARKERS.has(ip) || isPrivateIpv4(ip)) continue;
    return ip;
  }
  return null;
}

export async function getCountryFromIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const baseUrl = process.env.IPAPI_BASE_URL?.trim() || "https://ipapi.co";
  try {
    const url = `${baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(ip)}/country/`;
    const response = await axios.get<string>(url, { timeout: 3000 });
    const country = String(response.data ?? "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(country)) return country;
    return null;
  } catch {
    return null;
  }
}
