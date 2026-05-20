import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CompanySearchAutocomplete } from "./CompanySearchAutocomplete";

type GlobalSearchBarProps = {
  variant?: "desktop" | "mobile";
  glass?: boolean;
};

export function GlobalSearchBar({ variant = "desktop", glass = false }: GlobalSearchBarProps) {
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
          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition hover:border-[#00C9D4]/40 hover:shadow-[0_0_0_3px_rgba(0,201,212,0.1)] ${
            glass
              ? "border-white/15 bg-white/5 text-[#00C9D4]"
              : "border-border/80 bg-bgSecondary/50 text-brandDark"
          }`}
          aria-label={placeholder}
          onClick={() => setMobileExpanded(true)}
        >
          <MagnifyingGlassIcon className="h-5 w-5" aria-hidden />
        </button>
      );
    }

    return (
      <div
        className={`absolute inset-x-0 top-full z-50 border-b p-3 shadow-md backdrop-blur-md ${
          glass ? "border-white/10 bg-[#1a0538]/95" : "border-border bg-bgPrimary"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <CompanySearchAutocomplete placeholder={placeholder} compact variant={glass ? "glass" : "light"} />
          </div>
          <button
            type="button"
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
              glass ? "border-white/15 text-white/60" : "border-border text-textSecondary"
            }`}
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
    <div className="hidden h-10 w-[240px] max-w-[240px] shrink-0 grow-0 basis-[240px] md:block">
      <CompanySearchAutocomplete placeholder={placeholder} compact variant={glass ? "glass" : "light"} />
    </div>
  );
}
