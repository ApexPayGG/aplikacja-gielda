import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { TerminalPage } from "../components/terminal/TerminalPage";
import { TerminalButton } from "../components/terminal/TerminalButton";
import {
  TERMINAL_APP_BG,
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_DANGER_TEXT,
  TERMINAL_FORM_GROUP,
  TERMINAL_FORM_LABEL,
  TERMINAL_INPUT,
  TERMINAL_SETTINGS_CARD,
  TERMINAL_SETTINGS_ROW,
  TERMINAL_SUCCESS_TEXT,
} from "../components/terminal/terminalStyles";
import { useAuth } from "../context/AuthContext";
import { getUserProfile, updateUserProfile, type UserProfile } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

type LanguageOption = {
  code: string;
  label: string;
  flag: string;
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "pl", label: "Polski", flag: "🇵🇱" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "uk", label: "Українська", flag: "🇺🇦" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
];

const TIMEZONE_OPTIONS = [
  "Europe/Warsaw",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "America/New_York",
  "America/Chicago",
  "Asia/Tokyo",
  "Asia/Singapore",
];

function getInitials(name: string, email: string): string {
  const tokens = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length > 0) {
    return tokens
      .slice(0, 2)
      .map((token) => token[0]?.toUpperCase() ?? "")
      .join("");
  }
  const base = email.split("@")[0]?.trim() ?? "";
  return (base.slice(0, 2) || "U").toUpperCase();
}

export function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pl");
  const [timezone, setTimezone] = useState("Europe/Warsaw");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const data = await getUserProfile(userId);
        setProfile(data);
        setName(data.name ?? "");
        setLanguage(data.language ?? "pl");
        setTimezone(data.timezone ?? "Europe/Warsaw");
      } catch (error) {
        setErrorMessage(apiErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [userId]);

  const emailValue = profile?.email ?? user?.email ?? "—";
  const currentPlan = profile?.tier ?? user?.tier ?? "FREE";
  const avatarUrl = profile?.avatarUrl;
  const avatarLabel = useMemo(() => getInitials(name || profile?.name || "", emailValue), [emailValue, name, profile?.name]);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const updated = await updateUserProfile(userId, {
        name: name.trim() || null,
        language,
        timezone,
      });
      setProfile(updated);
      setStatusMessage(t("profilePage.saved", { defaultValue: "Your changes were saved." }));
    } catch (error) {
      setErrorMessage(apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={TERMINAL_APP_BG}>
        <TerminalPage title={t("profilePage.title", { defaultValue: "My profile" })}>
          <div className={`${TERMINAL_SETTINGS_CARD} animate-pulse text-terminal-textMuted`}>
            {t("profilePage.loadingProfile", { defaultValue: "Loading profile…" })}
          </div>
        </TerminalPage>
      </div>
    );
  }

  return (
    <div className={TERMINAL_APP_BG}>
      <TerminalPage
        title={t("profilePage.title", { defaultValue: "My profile" })}
        contentClassName="max-w-4xl space-y-6"
      >
        <section className={TERMINAL_SETTINGS_CARD}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-terminal-cyan/30 bg-terminal-cyan/15 text-lg font-semibold text-terminal-cyan">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={t("profilePage.avatarAlt", { defaultValue: "User avatar" })}
                  className="h-full w-full object-cover"
                />
              ) : (
                avatarLabel
              )}
            </div>
            <div>
              <button
                type="button"
                disabled
                className="rounded-lg border border-terminal-borderMuted px-4 py-2 text-sm font-medium text-terminal-textMuted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("profilePage.changeAvatar", { defaultValue: "Change avatar" })}
              </button>
            </div>
          </div>
        </section>

        <section className={TERMINAL_SETTINGS_CARD}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className={TERMINAL_FORM_GROUP}>
              <span className={TERMINAL_FORM_LABEL}>{t("profilePage.fullName", { defaultValue: "Full name" })}</span>
              <input type="text" value={name} onChange={(event) => setName(event.target.value)} className={TERMINAL_INPUT} />
            </label>

            <label className={TERMINAL_FORM_GROUP}>
              <span className={TERMINAL_FORM_LABEL}>{t("auth.email")}</span>
              <input type="email" value={emailValue} readOnly className={`${TERMINAL_INPUT} opacity-80`} />
            </label>

            <label className={TERMINAL_FORM_GROUP}>
              <span className={TERMINAL_FORM_LABEL}>{t("profilePage.language", { defaultValue: "Language" })}</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value)} className={TERMINAL_INPUT}>
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.flag} {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={TERMINAL_FORM_GROUP}>
              <span className={TERMINAL_FORM_LABEL}>{t("profilePage.timezone", { defaultValue: "Time zone" })}</span>
              <select value={timezone} onChange={(event) => setTimezone(event.target.value)} className={TERMINAL_INPUT}>
                {TIMEZONE_OPTIONS.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className={TERMINAL_SETTINGS_CARD}>
          <div className={`flex flex-wrap items-center justify-between gap-4 ${TERMINAL_SETTINGS_ROW}`}>
            <div>
              <p className={TERMINAL_FORM_LABEL}>{t("profilePage.currentPlan", { defaultValue: "Current plan" })}</p>
              <span className="mt-2 inline-flex rounded-full border border-terminal-cyan/40 bg-terminal-cyan/15 px-3 py-1 text-xs font-semibold text-terminal-cyan">
                {currentPlan}
              </span>
            </div>
            <Link to="/pricing" className={TERMINAL_BUTTON_PRIMARY}>
              {t("profilePage.upgrade", { defaultValue: "Upgrade" })}
            </Link>
          </div>
        </section>

        {statusMessage ? <p className={`text-sm ${TERMINAL_SUCCESS_TEXT}`}>{statusMessage}</p> : null}
        {errorMessage ? <p className={`text-sm ${TERMINAL_DANGER_TEXT}`}>{errorMessage}</p> : null}

        <div className="flex flex-col items-start gap-4">
          <TerminalButton type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? t("profilePage.saving", { defaultValue: "Saving…" }) : t("profilePage.saveChanges", { defaultValue: "Save changes" })}
          </TerminalButton>

          <button type="button" className={`text-sm underline transition hover:opacity-80 ${TERMINAL_DANGER_TEXT}`}>
            {t("profilePage.deleteAccount", { defaultValue: "Delete account" })}
          </button>
        </div>
      </TerminalPage>
    </div>
  );
}
