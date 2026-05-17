import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, getAffiliateBrokers, type AffiliateBrokerItem } from "../../services/api";
import { trackEvent } from "../../utils/analytics";
import { apiErrorMessage } from "../../utils/apiErrorMessage";
import { DisclosureNote } from "./DisclosureNote";

type BrokerCTAButtonProps = {
  ticker?: string;
  signalId?: string;
  sourcePage:
    | "company_detail"
    | "signals"
    | "premium_analysis"
    | "watchlist"
    | "alpaca_dashboard"
    | "settings";
  market?: string;
  size?: "small" | "medium" | "large";
  variant?: "primary" | "secondary";
  className?: string;
  brokerSlug?: string;
  label?: string;
  icon?: ReactNode;
  showDisclosure?: boolean;
};

function sizeClass(size: BrokerCTAButtonProps["size"]): string {
  if (size === "small") return "px-3 py-2 text-sm";
  if (size === "large") return "px-5 py-3 text-base";
  return "px-4 py-2.5 text-sm";
}

function variantClass(variant: BrokerCTAButtonProps["variant"]): string {
  if (variant === "secondary") {
    return "border border-brand-border bg-slate-900/70 text-slate-100 hover:border-brand-blue/50";
  }
  return "bg-brand-green text-black hover:bg-brand-green/90";
}

function buildRedirectUrl(params: {
  brokerSlug: string;
  ticker?: string;
  sourcePage: string;
  signalId?: string;
}): string {
  const base = String(api.defaults.baseURL ?? "/api").replace(/\/+$/, "");
  const url = new URL(`${base}/affiliate/redirect`, window.location.origin);
  url.searchParams.set("broker", params.brokerSlug);
  url.searchParams.set("page", params.sourcePage);
  if (params.ticker) url.searchParams.set("ticker", params.ticker.trim().toUpperCase());
  if (params.signalId) url.searchParams.set("signal", params.signalId);
  if (base.startsWith("http://") || base.startsWith("https://")) return url.toString();
  return `${base}/affiliate/redirect?${url.searchParams.toString()}`;
}

export function BrokerCTAButton({
  ticker,
  signalId,
  sourcePage,
  market,
  size = "medium",
  variant = "primary",
  className = "",
  brokerSlug,
  label,
  icon,
  showDisclosure = true,
}: BrokerCTAButtonProps) {
  const { t } = useTranslation("common");
  const [brokers, setBrokers] = useState<AffiliateBrokerItem[]>([]);
  const [defaultBroker, setDefaultBroker] = useState<AffiliateBrokerItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const data = await getAffiliateBrokers({ market });
        if (cancelled) return;
        setBrokers(data.brokers);
        setDefaultBroker(data.defaultBroker);
      } catch (e) {
        if (cancelled) return;
        setError(apiErrorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [market]);

  const selectedBroker = useMemo(() => {
    if (!defaultBroker) return null;
    if (!brokerSlug) return defaultBroker;
    const normalizedSlug = brokerSlug.trim().toLowerCase();
    return brokers.find((broker) => broker.slug.trim().toLowerCase() === normalizedSlug) ?? null;
  }, [brokerSlug, brokers, defaultBroker]);

  const hasOptions = !brokerSlug && (brokers?.length ?? 0) > 1;
  const wrapperClass = useMemo(
    () => `${className} flex flex-col gap-2`,
    [className],
  );

  const handleRedirect = (brokerSlug: string) => {
    const seenKey = "affiliateDisclosureSeen";
    const seen = typeof window !== "undefined" ? window.localStorage.getItem(seenKey) === "true" : true;
    if (!seen) {
      setShowOnboarding(true);
      return;
    }
    const url = buildRedirectUrl({
      brokerSlug,
      ticker,
      sourcePage,
      signalId,
    });
    if (brokerSlug.trim().toLowerCase() === "etoro") {
      trackEvent("affiliate_click", { broker: "etoro" });
    }
    window.location.assign(url);
  };

  const handleRedirectConfirmed = (brokerSlug: string) => {
    if (typeof window !== "undefined") window.localStorage.setItem("affiliateDisclosureSeen", "true");
    setShowOnboarding(false);
    const url = buildRedirectUrl({
      brokerSlug,
      ticker,
      sourcePage,
      signalId,
    });
    if (brokerSlug.trim().toLowerCase() === "etoro") {
      trackEvent("affiliate_click", { broker: "etoro" });
    }
    window.location.assign(url);
  };

  if (error || !selectedBroker) return null;

  return (
    <div className={wrapperClass}>
      <button
        type="button"
        onClick={() => handleRedirect(selectedBroker.slug)}
        className={`inline-flex items-center justify-center rounded-lg font-semibold transition ${sizeClass(size)} ${variantClass(variant)}`}
      >
        {icon ? <span className="mr-2 inline-flex items-center">{icon}</span> : null}
        {label ??
          t("affiliate.cta.buy_through", {
            ticker: ticker || "",
            broker: selectedBroker.displayName,
            defaultValue: "Buy {{ticker}} via {{broker}}",
          })}
      </button>

      {hasOptions && (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="self-start text-xs text-brand-blue hover:underline"
        >
          {t("affiliate.cta.other_options", {
            count: brokers.length - 1,
            defaultValue: "Other options ({{count}})",
          })}
        </button>
      )}

      {showDisclosure ? <DisclosureNote broker={selectedBroker} variant="inline" /> : null}

      {showModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-surface-border bg-brand-bg p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {t("affiliate.modal.title", { defaultValue: "Choose a broker" })}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                {t("affiliate.modal.close", { defaultValue: "Close" })}
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-400">
              {t("affiliate.modal.subtitle", {
                defaultValue: "Pick the broker that matches your preferences.",
              })}
            </p>
            <div className="space-y-2">
              {brokers.map((broker) => (
                <button
                  key={broker.slug}
                  type="button"
                  onClick={() => handleRedirect(broker.slug)}
                  className="flex w-full items-center justify-between rounded-lg border border-surface-border bg-slate-900/60 px-3 py-2 text-left hover:border-brand-blue/40"
                >
                  <span className="font-medium text-white">{broker.displayName}</span>
                  <span className="text-xs text-brand-blue">
                    {t("affiliate.modal.select", { defaultValue: "Select" })}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <DisclosureNote broker={selectedBroker} variant="full" />
            </div>
          </div>
        </div>
      )}

      {showOnboarding && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-surface-border bg-brand-bg p-5">
            <h3 className="text-lg font-semibold text-white">
              {t("affiliate.onboarding.title", { defaultValue: "How this works" })}
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              {t("affiliate.onboarding.body", {
                defaultValue:
                  "We redirect you to the selected broker to open an account and execute the trade. We may receive a commission from the broker, never from you.",
              })}
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-400">
              <li>{t("affiliate.onboarding.point_data", { defaultValue: "Your data stays with you." })}</li>
              <li>
                {t("affiliate.onboarding.point_commission", {
                  defaultValue: "StockAI earns broker commission only.",
                })}
              </li>
              <li>
                {t("affiliate.onboarding.point_change", {
                  defaultValue: "You can choose a different broker any time.",
                })}
              </li>
            </ul>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => handleRedirectConfirmed(selectedBroker.slug)}
                className="rounded-lg bg-brand-green px-3 py-2 text-sm font-semibold text-black"
              >
                {t("affiliate.onboarding.confirm", { defaultValue: "I understand, continue" })}
              </button>
              <button
                type="button"
                onClick={() => setShowOnboarding(false)}
                className="rounded-lg border border-surface-border px-3 py-2 text-sm text-slate-300"
              >
                {t("affiliate.onboarding.cancel", { defaultValue: "Cancel" })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
