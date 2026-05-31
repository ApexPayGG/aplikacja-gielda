import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TERMINAL_LINK_ACCENT } from "../terminal/terminalStyles";

export function DividendHubBackLink() {
  const { t } = useTranslation();
  return (
    <Link to="/dividend" className={`text-sm ${TERMINAL_LINK_ACCENT}`}>
      {t("dividendHub.backToHub", { defaultValue: "← Dividend Hub" })}
    </Link>
  );
}
