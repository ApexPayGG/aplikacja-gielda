const ETORO_LINKS: Record<string, string> = {
  pl: "https://med.etoro.com/B9219_A129734_TClick_Sstockaipro-main.aspx",
  en: "https://med.etoro.com/B12087_A129734_TClick_Sstockaipro-main.aspx",
  fr: "https://med.etoro.com/B217_A129734_TClick_Sstockaipro-main.aspx",
  de: "https://med.etoro.com/B19298_A129734_TClick_Sstockaipro-main.aspx",
  es: "https://med.etoro.com/B210_A129734_TClick_Sstockaipro-main.aspx",
};

const ETORO_FALLBACK_LINK = ETORO_LINKS.en;

function normalizeLanguage(lang: string): string {
  const normalized = String(lang ?? "").trim().toLowerCase();
  if (!normalized) return "en";
  const base = normalized.split(/[-_]/)[0]?.trim();
  return base || "en";
}

export function getEtoroLink(lang: string): string {
  const language = normalizeLanguage(lang);
  return ETORO_LINKS[language] ?? ETORO_FALLBACK_LINK;
}
