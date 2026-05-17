import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { colors } from "../styles/designSystem";
import { setCookieConsent, type CookieConsentType } from "../utils/cookieConsent";

type CookieConsentProps = {
  onConsent: (type: CookieConsentType) => void;
};

export function CookieConsent({ onConsent }: CookieConsentProps) {
  const { t } = useTranslation();

  function handleConsent(type: CookieConsentType) {
    setCookieConsent(type);
    onConsent(type);
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] border-t px-4 py-4"
      style={{
        backgroundColor: colors.bgPrimary,
        borderColor: colors.border,
        boxShadow: "0 -10px 24px rgba(13, 13, 26, 0.12)",
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm" style={{ color: colors.textPrimary }}>
          {t("cookie.message")}{" "}
          <Link to="/privacy" className="font-semibold underline" style={{ color: colors.brandCyan }}>
            {t("cookie.privacyLink")}
          </Link>
        </p>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: colors.brandDark, color: colors.bgPrimary }}
            onClick={() => handleConsent("all")}
          >
            {t("cookie.acceptAll")}
          </button>
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: colors.brandDark, color: colors.brandDark, backgroundColor: colors.bgPrimary }}
            onClick={() => handleConsent("necessary")}
          >
            {t("cookie.necessaryOnly")}
          </button>
        </div>
      </div>
    </div>
  );
}
