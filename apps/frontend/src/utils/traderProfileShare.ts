import type { PsycheRadarPoint } from "./behavioralCoachData";

export const TRADER_PROFILE_SHARE_URL = "https://stockai.pro";

export type TraderProfileSharePayloads = {
  disciplineScore: number;
  fomoScore: number;
  twitterText: string;
  linkedInPost: string;
  facebookPost: string;
  universalClipboard: string;
  twitterIntentUrl: string;
  linkedInIntentUrl: string;
  facebookIntentUrl: string;
  threadsIntentUrl: string;
};

function metricScore(metrics: PsycheRadarPoint[], needle: string, fallback: number): number {
  const row = metrics.find((item) => item.metric.toLowerCase().includes(needle.toLowerCase()));
  return row?.score ?? fallback;
}

export function buildTraderProfileSharePayloads(metrics: PsycheRadarPoint[]): TraderProfileSharePayloads {
  const disciplineScore = metricScore(metrics, "dyscyplina", 85);
  const fomoScore = metricScore(metrics, "fomo", 62);

  const twitterText =
    `Mój indeks dyscypliny inwestycyjnej na StockAI Pro wynosi ${disciplineScore}%, ale muszę popracować nad odpornością na FOMO! 🧠📉 Sprawdź profil swojej psychiki tradera i okiełznaj emocje na giełdzie: ${TRADER_PROFILE_SHARE_URL} @StockAI_Pro #FinTwit #Trading`;

  const linkedInPost =
    "Analiza mojego profilu psychologicznego jako inwestora na platformie StockAI Pro wykazuje wysoką dyscyplinę, ale wskazuje na przestrzeń do optymalizacji w zakresie zarządzania FOMO. Świetne narzędzie bazujące na AI Coachu do optymalizacji decyzji na rynkach finansowych. Polecam każdemu traderowi. #Investing #BehavioralFinance #ArtificialIntelligence";

  const facebookPost =
    "Okiełznałem swoje emocje na giełdzie! Mój radar psychiki tradera na StockAI Pro pokazuje, gdzie popełniam błędy przez FOMO i chciwość. Jeśli handlujesz na akcjach lub krypto, sprawdź swój darmowy profil: https://stockai.pro #Trading #Stocks #PsychologiaInwestowania";

  const universalClipboard = `${twitterText}`;

  return {
    disciplineScore,
    fomoScore,
    twitterText,
    linkedInPost,
    facebookPost,
    universalClipboard,
    twitterIntentUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}`,
    linkedInIntentUrl: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(TRADER_PROFILE_SHARE_URL)}`,
    facebookIntentUrl: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(TRADER_PROFILE_SHARE_URL)}`,
    threadsIntentUrl: `https://www.threads.net/intent/post?text=${encodeURIComponent(twitterText)}`,
  };
}
