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
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border text-brandDark transition hover:border-brandDark/40"
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
    <div className="hidden w-44 shrink-0 lg:block xl:w-52">
      <CompanySearchAutocomplete placeholder={placeholder} compact />
    </div>
  );
}
