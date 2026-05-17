import { useEffect } from "react";

interface SEOHeadProps {
  title: string;
  description: string;
  ogImage?: string;
  ogType?: string;
  canonicalUrl?: string;
  structuredData?: object;
}

const DEFAULT_OG_IMAGE_PATH = "/og-default.png";
const STRUCTURED_DATA_SCRIPT_ID = "stockai-structured-data";

function toAbsoluteUrl(value: string): string {
  if (typeof window === "undefined") return value;
  try {
    return new URL(value, window.location.origin).href;
  } catch {
    return value;
  }
}

function upsertMeta(attr: "name" | "property", key: string, content: string): void {
  let meta = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attr, key);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

function upsertCanonical(url: string): void {
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", url);
}

function upsertStructuredData(structuredData?: object): void {
  const existing = document.head.querySelector(`#${STRUCTURED_DATA_SCRIPT_ID}`);
  if (!structuredData) {
    if (existing) existing.remove();
    return;
  }

  const script = existing ?? document.createElement("script");
  script.setAttribute("id", STRUCTURED_DATA_SCRIPT_ID);
  script.setAttribute("type", "application/ld+json");
  script.textContent = JSON.stringify(structuredData);
  if (!existing) {
    document.head.appendChild(script);
  }
}

export function SEOHead({
  title,
  description,
  ogImage,
  ogType = "website",
  canonicalUrl,
  structuredData,
}: SEOHeadProps) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const canonicalHref = toAbsoluteUrl(canonicalUrl ?? window.location.href);
    const ogImageHref = toAbsoluteUrl(ogImage ?? DEFAULT_OG_IMAGE_PATH);

    document.title = title;

    upsertMeta("name", "description", description);

    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", ogType);
    upsertMeta("property", "og:url", canonicalHref);
    upsertMeta("property", "og:image", ogImageHref);
    upsertMeta("property", "og:site_name", "StockAI Pro");

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", ogImageHref);

    upsertCanonical(canonicalHref);
    upsertStructuredData(structuredData);
  }, [title, description, ogImage, ogType, canonicalUrl, structuredData]);

  return null;
}
