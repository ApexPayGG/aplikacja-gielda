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
