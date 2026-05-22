import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getUserProfile, updateUserProfile, type UserProfile } from "../services/api";
import { colors } from "../styles/designSystem";
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

  const fieldClass =
    "w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#22d3ee]/50 focus:ring-2 focus:ring-[#22d3ee]/20";

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
      <div className="min-h-screen px-4 py-8" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
        <div className="mx-auto max-w-4xl rounded-2xl border p-6 glass-section">
          {t("profilePage.loadingProfile", { defaultValue: "Loading profile…" })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
            {t("profilePage.title", { defaultValue: "My profile" })}
          </h1>
        </header>

        <section
          className="rounded-2xl border p-6 shadow-[0_12px_24px_rgba(168,85,247,0.08)]"
          style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
        >
          <div className="flex flex-wrap items-center gap-4">
            <div
              className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full text-lg font-semibold text-white"
              style={{ backgroundColor: colors.brandDark }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={t("profilePage.avatarAlt", { defaultValue: "User avatar" })} className="h-full w-full object-cover" />
              ) : (
                avatarLabel
              )}
            </div>
            <div>
              <button
                type="button"
                disabled
                className="rounded-xl border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                style={{ borderColor: colors.borderStrong, color: colors.textSecondary }}
              >
                {t("profilePage.changeAvatar", { defaultValue: "Change avatar" })}
              </button>
            </div>
          </div>
        </section>

        <section
          className="rounded-2xl border p-6 shadow-[0_12px_24px_rgba(168,85,247,0.08)]"
          style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium" style={{ color: colors.textSecondary }}>
                {t("profilePage.fullName", { defaultValue: "Full name" })}
              </span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={fieldClass}
                style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium" style={{ color: colors.textSecondary }}>
                {t("auth.email")}
              </span>
              <input
                type="email"
                value={emailValue}
                readOnly
                className={fieldClass}
                style={{ borderColor: colors.border, color: colors.textMuted, backgroundColor: colors.bgSecondary }}
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium" style={{ color: colors.textSecondary }}>
                {t("profilePage.language", { defaultValue: "Language" })}
              </span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className={fieldClass}
                style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.flag} {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium" style={{ color: colors.textSecondary }}>
                {t("profilePage.timezone", { defaultValue: "Time zone" })}
              </span>
              <select
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className={fieldClass}
                style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
              >
                {TIMEZONE_OPTIONS.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section
          className="rounded-2xl border p-6 shadow-[0_12px_24px_rgba(168,85,247,0.08)]"
          style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                {t("profilePage.currentPlan", { defaultValue: "Current plan" })}
              </p>
              <span
                className="mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: colors.brandDark }}
              >
                {currentPlan}
              </span>
            </div>
            <Link
              to="/pricing"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: colors.brandMedium }}
            >
              {t("profilePage.upgrade", { defaultValue: "Upgrade" })}
            </Link>
          </div>
        </section>

        {statusMessage ? <p className="text-sm" style={{ color: colors.positive }}>{statusMessage}</p> : null}
        {errorMessage ? <p className="text-sm" style={{ color: colors.negative }}>{errorMessage}</p> : null}

        <div className="flex flex-col items-start gap-4">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: colors.brandDark }}
          >
            {saving ? t("profilePage.saving", { defaultValue: "Saving…" }) : t("profilePage.saveChanges", { defaultValue: "Save changes" })}
          </button>

          <button
            type="button"
            className="text-sm underline transition hover:opacity-80"
            style={{ color: colors.negative }}
          >
            {t("profilePage.deleteAccount", { defaultValue: "Delete account" })}
          </button>
        </div>
      </div>
    </div>
  );
}
