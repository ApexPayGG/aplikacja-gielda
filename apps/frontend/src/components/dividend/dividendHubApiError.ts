import axios from "axios";
import type { TFunction } from "i18next";
import { apiErrorMessage } from "../../utils/apiErrorMessage";

export function isDividendHubAccessDenied(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === 401 || status === 403;
}

export function resolveDividendHubLoadError(
  error: unknown,
  t: TFunction,
): { accessDenied: boolean; message: string } {
  if (isDividendHubAccessDenied(error)) {
    return {
      accessDenied: true,
      message: t("dividendHub.authRequired", {
        defaultValue: "Sign in or activate your plan to view dividend calendar data.",
      }),
    };
  }
  return { accessDenied: false, message: apiErrorMessage(error) };
}

export function isRawAuthErrorMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  return normalized === "unauthorized" || normalized === "forbidden" || normalized === "401" || normalized === "403";
}

export function resolveCompanyDividendLoadError(
  error: unknown,
  t: TFunction,
): { accessDenied: boolean; message: string; detail: string } {
  if (isDividendHubAccessDenied(error)) {
    return {
      accessDenied: true,
      message: t("company.dividend.authTitle", {
        defaultValue: "Dividend data requires an active session or plan access.",
      }),
      detail: t("company.dividend.authBody", {
        defaultValue:
          "Refresh your session or view plans to unlock dividend history and payout risk.",
      }),
    };
  }
  const message = apiErrorMessage(error);
  if (isRawAuthErrorMessage(message)) {
    return {
      accessDenied: true,
      message: t("company.dividend.authTitle", {
        defaultValue: "Dividend data requires an active session or plan access.",
      }),
      detail: t("company.dividend.authBody", {
        defaultValue:
          "Refresh your session or view plans to unlock dividend history and payout risk.",
      }),
    };
  }
  return {
    accessDenied: false,
    message,
    detail: "",
  };
}
