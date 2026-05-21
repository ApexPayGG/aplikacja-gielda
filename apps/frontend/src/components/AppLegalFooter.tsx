import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { hasCompletedOnboarding } from "../utils/onboarding";

const HIDDEN_PREFIXES = [
  "/login",
  "/register",
  "/privacy",
  "/terms",
  "/onboarding",
  "/verify",
  "/forgot-password",
  "/reset-password",
];

export function AppLegalFooter() {
  const { pathname } = useLocation();
  const { token } = useAuth();
  const glass = Boolean(token) && hasCompletedOnboarding();

  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <footer
      className={`mx-auto max-w-6xl border-t px-4 py-5 pb-24 text-center md:pb-8 ${
        glass ? "border-white/10" : "border-border"
      }`}
    >
      <p className={`text-[11px] ${glass ? "text-white/50" : "text-textSecondary"}`}>
        <Link to="/terms" className={`font-medium hover:underline ${glass ? "text-[#00C9D4]" : "text-brandCyan"}`}>
          Regulamin
        </Link>
        {" · "}
        <Link to="/privacy" className={`font-medium hover:underline ${glass ? "text-[#00C9D4]" : "text-brandCyan"}`}>
          Polityka prywatności
        </Link>
      </p>
    </footer>
  );
}
