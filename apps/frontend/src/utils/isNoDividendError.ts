import axios from "axios";
import { apiErrorMessage } from "./apiErrorMessage";

const NO_DIVIDEND_PATTERNS = [
  "dividend data not found",
  "no valid dividend rows",
  "no_dividend",
  "does not pay a dividend",
  "no dividend",
] as const;

function messageLooksLikeNoDividend(message: string): boolean {
  const lower = message.trim().toLowerCase();
  if (!lower) return false;
  return NO_DIVIDEND_PATTERNS.some((p) => lower.includes(p));
}

/** True when API indicates the company has no dividend program / payout history. */
export function isNoDividendMessage(message: string): boolean {
  return messageLooksLikeNoDividend(message);
}

export function isNoDividendError(e: unknown): boolean {
  if (axios.isAxiosError(e)) {
    const body = e.response?.data;
    if (body && typeof body === "object") {
      if ("code" in body && (body as { code: unknown }).code === "NO_DIVIDEND") return true;
      if ("error" in body) {
        const apiErr = String((body as { error: unknown }).error);
        if (messageLooksLikeNoDividend(apiErr)) return true;
      }
    }
    if (e.response?.status === 404) {
      const msg = apiErrorMessage(e);
      if (messageLooksLikeNoDividend(msg)) return true;
    }
  }
  return messageLooksLikeNoDividend(apiErrorMessage(e));
}
