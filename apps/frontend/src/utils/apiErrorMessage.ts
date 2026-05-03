import axios from "axios";

/** Prefer API JSON `{ error: string }` over generic Axios status text. */
export function apiErrorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const body = e.response?.data;
    if (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string") {
      return (body as { error: string }).error;
    }
    return e.message;
  }
  return e instanceof Error ? e.message : "Request failed";
}
