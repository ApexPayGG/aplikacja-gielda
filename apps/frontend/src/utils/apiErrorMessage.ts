import axios from "axios";
import { sanitizeApiErrorMessage } from "./sanitizeApiErrorMessage";

/** Prefer API JSON `{ error: string }` over generic Axios status text. */
export function apiErrorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const body = e.response?.data;
    if (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string") {
      return sanitizeApiErrorMessage((body as { error: string }).error) || "Request failed";
    }
    return sanitizeApiErrorMessage(e.message) || "Request failed";
  }
  if (e instanceof Error) {
    return sanitizeApiErrorMessage(e.message) || "Request failed";
  }
  return "Request failed";
}
