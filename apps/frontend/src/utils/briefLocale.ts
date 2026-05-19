import type { BriefSection } from "../services/api";

export function primaryLanguageBase(lang: string): string {
  const trimmed = lang.trim();
  if (!trimmed) return "en";
  return trimmed.split(/[-_]/)[0]!.toLowerCase();
}

/** Strip ===PRIMARY=== / ===ENGLISH=== markers when API returns a single legacy body string. */
export function parseMarkedBriefBody(raw: string, uiLocale: string): string {
  const text = raw.trim();
  const re = /^===PRIMARY===\s*\r?\n([\s\S]*?)\r?\n===ENGLISH===\s*\r?\n([\s\S]*)$/i;
  const m = text.match(re);
  if (!m) return text;
  return primaryLanguageBase(uiLocale) === "en" ? m[2]!.trim() : m[1]!.trim();
}

/** Show one brief block: EN locale → English only; otherwise primary locale only. */
export function pickBriefSectionsForLocale(sections: BriefSection[], uiLocale: string): BriefSection[] {
  if (sections.length === 0) return [];
  if (sections.length === 1) {
    const only = sections[0]!;
    return [{ lang: only.lang, body: parseMarkedBriefBody(only.body, uiLocale) }];
  }

  const wantEn = primaryLanguageBase(uiLocale) === "en";

  if (wantEn) {
    const en =
      sections.find((s) => primaryLanguageBase(s.lang) === "en") ??
      sections.find((s) => s.lang.toLowerCase() === "en") ??
      sections[sections.length - 1];
    return en ? [{ lang: en.lang, body: parseMarkedBriefBody(en.body, uiLocale) }] : [sections[0]!];
  }

  const primary =
    sections.find(
      (s) =>
        s.lang.toLowerCase() === uiLocale.toLowerCase() ||
        primaryLanguageBase(s.lang) === primaryLanguageBase(uiLocale),
    ) ?? sections.find((s) => primaryLanguageBase(s.lang) !== "en");

  const chosen = primary ?? sections[0]!;
  return [{ lang: chosen.lang, body: parseMarkedBriefBody(chosen.body, uiLocale) }];
}
