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
import { TerminalPanel, TerminalTabs, TerminalWorkspacePage } from "../components/terminal";

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

  const tabs = useMemo(
    () =>
      DIVIDEND_HUB_VIEWS.map((id) => ({
        id,
        label: tabLabel(id, t),
      })),
    [t],
  );

  function setView(next: DividendHubView): void {
    setSearchParams(next === "radar" ? {} : { view: next }, { replace: true });
  }

  return (
    <TerminalWorkspacePage
      eyebrow={t("terminalNav.dividendHub", { defaultValue: "Dividend Hub" })}
      title={t("dividendHub.title", { defaultValue: "Dividend Hub" })}
      subtitle={t("dividendHub.subtitle", {
        defaultValue:
          "Research dividend quality, income screening and tools in one place — part of your investing workflow.",
      })}
      contentClassName="space-y-4"
    >
      <DividendHubDisclaimer />

      <TerminalTabs
        tabs={tabs}
        activeId={view}
        onChange={setView}
        ariaLabel={t("dividendHub.tabsAria", { defaultValue: "Dividend Hub sections" })}
      />

      <TerminalPanel className="p-4 sm:p-5" role="tabpanel">
        {view === "radar" ? <DividendHubRadar /> : null}
        {view === "screener" ? <DividendHubScreener /> : null}
        {view === "intelligence" ? <DividendHubToolPanel view="intelligence" /> : null}
        {view === "compound" ? <DividendHubToolPanel view="compound" /> : null}
      </TerminalPanel>
    </TerminalWorkspacePage>
  );
}
