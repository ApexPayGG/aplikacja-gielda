import { randomBytes } from "node:crypto";
import type { Request } from "express";
import { prisma } from "../../db/index";
import { extractClientIp, getCountryFromIp } from "./geoIpService";

type TrackClickParams = {
  userId?: string;
  brokerSlug: string;
  ticker?: string;
  sourcePage: string;
  sourceSignalId?: string;
  request: Request;
};

type TrackClickResult = {
  clickId: string;
  redirectUrl: string;
  countryCode: string | null;
};

const ETORO_TRACKING_URL = "https://med.etoro.com/B9219_A129734_TClick_Sstockaipro-main.aspx";

function detectDeviceType(userAgent: string): "mobile" | "tablet" | "desktop" | "unknown" {
  const ua = userAgent.toLowerCase();
  if (!ua) return "unknown";
  if (ua.includes("tablet") || ua.includes("ipad")) return "tablet";
  if (ua.includes("mobi") || ua.includes("android")) return "mobile";
  return "desktop";
}

function normalizeLanguage(raw: string): string {
  const first = raw.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!first) return "en";
  const normalized = first.split("-")[0] ?? "en";
  return normalized.slice(0, 5) || "en";
}

function buildAffiliateUrl(input: {
  template: string;
  partnerId: string;
  clickId: string;
  ticker?: string;
  countryCode?: string | null;
  clickIdParam?: string;
}): string {
  let resolved = input.template
    .replaceAll("{partner_id}", encodeURIComponent(input.partnerId))
    .replaceAll("{click_id}", encodeURIComponent(input.clickId))
    .replaceAll("{ticker}", encodeURIComponent((input.ticker ?? "").trim().toUpperCase()))
    .replaceAll("{country}", encodeURIComponent((input.countryCode ?? "").trim().toUpperCase()));

  if (!resolved.includes(input.clickId) && !resolved.includes("{click_id}")) {
    const param = input.clickIdParam?.trim() || "cid";
    const separator = resolved.includes("?") ? "&" : "?";
    resolved += `${separator}${encodeURIComponent(param)}=${encodeURIComponent(input.clickId)}`;
  }

  return resolved;
}

function generateClickId(length = 12): string {
  return randomBytes(12).toString("base64url").slice(0, length);
}

function isCountryEligible(supportedCountries: string[], countryCode: string | null): boolean {
  if (supportedCountries.length === 0) return true;
  if (!countryCode) return true;
  return supportedCountries.includes(countryCode.toUpperCase());
}

export class ClickTrackingService {
  async trackClick(params: TrackClickParams): Promise<TrackClickResult> {
    const brokerSlug = params.brokerSlug.trim().toLowerCase();
    if (!brokerSlug) throw new Error("Missing broker");

    const broker = await prisma.affiliateBroker.findUnique({ where: { slug: brokerSlug } });
    if (!broker || !broker.isActive) throw new Error(`Broker ${brokerSlug} not available`);

    const clientIp = extractClientIp({
      forwardedFor: params.request.headers["x-forwarded-for"],
      realIp: typeof params.request.headers["x-real-ip"] === "string" ? params.request.headers["x-real-ip"] : undefined,
      reqIp: params.request.ip,
      remoteAddress: params.request.socket.remoteAddress,
    });
    const countryCode = await getCountryFromIp(clientIp);

    if (!isCountryEligible(broker.supportedCountries, countryCode)) {
      throw new Error(`Broker ${brokerSlug} not available in ${countryCode ?? "unknown"}`);
    }

    const clickId = generateClickId(12);
    const ticker = (params.ticker ?? "").trim().toUpperCase() || undefined;
    const template =
      brokerSlug === "etoro"
        ? ETORO_TRACKING_URL
        : ticker && broker.tickerUrlTemplate
          ? broker.tickerUrlTemplate
          : broker.baseUrl;
    const redirectUrl = buildAffiliateUrl({
      template,
      partnerId: broker.partnerId,
      clickId,
      ticker,
      countryCode,
      clickIdParam: broker.clickIdParam,
    });

    const userAgent = String(params.request.headers["user-agent"] ?? "");
    const acceptLanguage = String(params.request.headers["accept-language"] ?? "");

    await prisma.affiliateClick.create({
      data: {
        clickId,
        userId: params.userId?.trim() || null,
        brokerId: broker.id,
        sourcePage: params.sourcePage,
        sourceTicker: ticker ?? null,
        sourceSignalId: params.sourceSignalId?.trim() || null,
        contextData: {
          referrer: params.request.headers.referer ?? null,
        },
        ipAddress: clientIp,
        userAgent: userAgent || null,
        countryCode,
        language: normalizeLanguage(acceptLanguage),
        deviceType: detectDeviceType(userAgent),
        utmSource: "stockai",
        utmMedium: "affiliate",
        utmCampaign: `${params.sourcePage}_${ticker ?? "generic"}`,
        redirectUrl,
      },
    });

    return { clickId, redirectUrl, countryCode };
  }
}
