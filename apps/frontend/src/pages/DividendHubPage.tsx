import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DividendHubDisclaimer } from "../components/dividend/DividendHubDisclaimer";
import { DividendHubRadar } from "../components/dividend/DividendHubRadar";
import { DividendHubScreener } from "../components/dividend/DividendHubScreener";
import { DividendHubToolPanel } from "../components/dividend/DividendHubToolPanel";
import {
  DIVIDEND_HUB_VIEWS,
  parseDividendHubView,
  type DividendHubView,
} from "../components/dividend/dividendHubShared";
import {
  TERMINAL_DIVIDEND_PAGE,
  TERMINAL_DIVIDEND_PAGE_INNER,
  TERMINAL_FILTER_CHIP,
  TERMINAL_FILTER_CHIP_ACTIVE,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_PAGE_TITLE,
} from "../components/terminal/terminalStyles";

function hubTabClass(active: boolean): string {
  return active ? TERMINAL_FILTER_CHIP_ACTIVE : TERMINAL_FILTER_CHIP;
}

function tabLabel(view: DividendHubView, t: ReturnType<typeof useTranslation>["t"]): string {
  switch (view) {
    case "radar":
      return t("dividendHub.tabRadar", { defaultValue: "Radar" });
    case "screener":
      return t("dividendHub.tabScreener", { defaultValue: "Screener" });
    case "intelligence":
      return t("dividendHub.tabIntelligence", { defaultValue: "Intelligence" });
    case "compound":
      return t("dividendHub.tabCompound", { defaultValue: "Compound" });
  }
}

export function DividendHubPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = useMemo(() => parseDividendHubView(searchParams.get("view")), [searchParams]);

  function setView(next: DividendHubView): void {
    setSearchParams(next === "radar" ? {} : { view: next }, { replace: true });
  }

  return (
    <div className={TERMINAL_DIVIDEND_PAGE}>
      <div className={TERMINAL_DIVIDEND_PAGE_INNER}>
        <header className="space-y-2">
          <h1 className={TERMINAL_PAGE_TITLE}>
            {t("dividendHub.title", { defaultValue: "Dividend Hub" })}
          </h1>
          <p className={TERMINAL_PAGE_SUBTITLE}>
            {t("dividendHub.subtitle", {
              defaultValue:
                "Research dividend quality, income screening and tools in one place — part of your investing workflow.",
            })}
          </p>
        </header>

        <DividendHubDisclaimer />

        <nav
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label={t("dividendHub.tabsAria", { defaultValue: "Dividend Hub sections" })}
        >
          {DIVIDEND_HUB_VIEWS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={view === tab}
              className={hubTabClass(view === tab)}
              onClick={() => setView(tab)}
            >
              {tabLabel(tab, t)}
            </button>
          ))}
        </nav>

        <div role="tabpanel" className="min-h-[12rem]">
          {view === "radar" ? <DividendHubRadar /> : null}
          {view === "screener" ? <DividendHubScreener /> : null}
          {view === "intelligence" ? <DividendHubToolPanel view="intelligence" /> : null}
          {view === "compound" ? <DividendHubToolPanel view="compound" /> : null}
        </div>
      </div>
    </div>
  );
}
