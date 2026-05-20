import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CompanySearchAutocomplete } from "./CompanySearchAutocomplete";

type GlobalSearchBarProps = {
  variant?: "desktop" | "mobile";
};

export function GlobalSearchBar({ variant = "desktop" }: GlobalSearchBarProps) {
  const { t } = useTranslation();
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const placeholder = t("nav.searchPlaceholder", { defaultValue: "Search company..." });

  useEffect(() => {
    if (variant !== "mobile" || !mobileExpanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [variant, mobileExpanded]);

  if (variant === "mobile") {
    if (!mobileExpanded) {
      return (
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-bgSecondary/50 text-brandDark transition hover:border-brandCyan/40 hover:shadow-[0_0_0_3px_rgba(0,201,212,0.1)]"
          aria-label={placeholder}
          onClick={() => setMobileExpanded(true)}
        >
          <MagnifyingGlassIcon className="h-5 w-5" aria-hidden />
        </button>
      );
    }

    return (
      <div className="absolute inset-x-0 top-full z-50 border-b border-border bg-bgPrimary p-3 shadow-md">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <CompanySearchAutocomplete placeholder={placeholder} compact />
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-textSecondary"
            aria-label={t("common.close", { defaultValue: "Close" })}
            onClick={() => setMobileExpanded(false)}
          >
            <XMarkIcon className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden w-full max-w-[240px] shrink-0 md:block">
      <CompanySearchAutocomplete placeholder={placeholder} compact />
    </div>
  );
}
