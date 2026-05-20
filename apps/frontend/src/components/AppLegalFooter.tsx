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

  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <footer className="mx-auto max-w-6xl border-t border-border px-4 py-5 pb-24 text-center md:pb-8">
      <p className="text-[11px] text-textSecondary">
        <Link to="/terms" className="font-medium text-brandCyan hover:underline">
          Regulamin
        </Link>
        {" · "}
        <Link to="/privacy" className="font-medium text-brandCyan hover:underline">
          Polityka prywatności
        </Link>
      </p>
    </footer>
  );
}
