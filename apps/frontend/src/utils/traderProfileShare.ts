import type { PsycheMetricKey, PsycheRadarPoint } from "./behavioralCoachData";

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

function metricScore(metrics: PsycheRadarPoint[], key: PsycheMetricKey, fallback: number): number {
  return metrics.find((item) => item.metricKey === key)?.score ?? fallback;
}

export function buildTraderProfileSharePayloads(metrics: PsycheRadarPoint[]): TraderProfileSharePayloads {
  const disciplineScore = metricScore(metrics, "discipline", 85);
  const fomoScore = metricScore(metrics, "fomoResilience", 62);

  const twitterText =
    `My investment discipline index on StockAI Pro is ${disciplineScore}%, but I still need to work on FOMO resilience! 🧠📉 Check your trader psyche profile: ${TRADER_PROFILE_SHARE_URL} @StockAI_Pro #FinTwit #Trading`;

  const linkedInPost =
    "My investor psychology profile on StockAI Pro shows strong discipline with room to improve FOMO management. A solid AI Coach tool for better market decisions. #Investing #BehavioralFinance #ArtificialIntelligence";

  const facebookPost =
    `I am working on market emotions! My trader psyche radar on StockAI Pro highlights FOMO and greed patterns. Check your profile: ${TRADER_PROFILE_SHARE_URL} #Trading #Stocks #InvestingPsychology`;

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
