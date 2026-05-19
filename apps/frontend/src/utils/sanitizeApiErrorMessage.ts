/** Hide upstream LLM/infra payloads from end users. */
export function sanitizeApiErrorMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return trimmed;

  const lower = trimmed.toLowerCase();
  if (
    lower.includes("authentication_error") ||
    lower.includes("invalid x-api-key") ||
    lower.includes("invalid api key") ||
    lower.includes("anthropic_api_key") ||
    /\b401\b/.test(lower)
  ) {
    return "";
  }

  if (trimmed.startsWith("{") && trimmed.includes('"type":"error"')) {
    return "";
  }

  return trimmed;
}
