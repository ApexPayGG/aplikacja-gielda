import { useEffect, useRef, useState } from "react";
import { ArrowDownTrayIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { api } from "../services/api";
import { colors } from "../styles/designSystem";

type ExportButtonProps = {
  endpoint: "/export/signals" | "/export/portfolio" | "/export/dividend";
  userId?: string;
  label?: string;
};

function resolveFilename(contentDisposition: string | undefined, fallbackPrefix: string): string {
  const raw = contentDisposition ?? "";
  const utf8Match = raw.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const quotedMatch = raw.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];
  const date = new Date().toISOString().slice(0, 10);
  return `${fallbackPrefix}-${date}.csv`;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

export function ExportButton({ endpoint, userId, label = "Eksportuj" }: ExportButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canExport = Boolean(userId) && !loading;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleCsvExport(): Promise<void> {
    if (!userId || loading) return;
    setLoading(true);
    setMenuOpen(false);
    try {
      const response = await api.get<Blob>(endpoint, {
        params: { userId, format: "csv" },
        responseType: "blob",
      });
      const headerValue = String(response.headers["content-disposition"] ?? "");
      const endpointName = endpoint.split("/").pop() || "export";
      const filename = resolveFilename(headerValue, endpointName);
      triggerBrowserDownload(response.data, filename);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative inline-flex" ref={containerRef}>
      <button
        type="button"
        disabled={!canExport}
        onClick={() => setMenuOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          borderColor: colors.brandDark,
          color: colors.brandDark,
          backgroundColor: colors.bgPrimary,
        }}
      >
        <ArrowDownTrayIcon className="h-4 w-4" />
        <span>{loading ? "Pobieranie..." : label}</span>
        <ChevronDownIcon className="h-4 w-4" />
      </button>

      {menuOpen ? (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-40 rounded-xl border p-1 shadow-lg"
          style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgPrimary }}
        >
          <button
            type="button"
            onClick={() => {
              void handleCsvExport();
            }}
            disabled={!canExport}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{ color: colors.textPrimary }}
          >
            <span>CSV</span>
          </button>
          <button
            type="button"
            disabled
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm opacity-70"
            style={{ color: colors.textMuted }}
          >
            <span>Excel</span>
            <span className="text-xs">wkrótce</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
