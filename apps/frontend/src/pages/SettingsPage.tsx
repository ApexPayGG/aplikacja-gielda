import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type MentorStyle = "supportive" | "strict";

function readStoredBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  return value === null ? fallback : value === "true";
}

function readStoredStyle(): MentorStyle {
  if (typeof window === "undefined") return "supportive";
  return window.localStorage.getItem("mentorStyle") === "strict" ? "strict" : "supportive";
}

export function SettingsPage() {
  const { t } = useTranslation();
  const [mentorEnabled, setMentorEnabled] = useState<boolean>(() =>
    readStoredBoolean("mentorModeEnabled", false),
  );
  const [mentorStyle, setMentorStyle] = useState<MentorStyle>(() => readStoredStyle());

  const statusLabel = useMemo(
    () => (mentorEnabled ? t("mentor.enabled") : t("mentor.disabled")),
    [mentorEnabled, t],
  );

  function updateMentorEnabled(value: boolean): void {
    setMentorEnabled(value);
    window.localStorage.setItem("mentorModeEnabled", String(value));
  }

  function updateMentorStyle(value: MentorStyle): void {
    setMentorStyle(value);
    window.localStorage.setItem("mentorStyle", value);
  }

  return (
    <div className="min-h-screen bg-brand-bg px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-3xl font-bold text-white">{t("mentor.settingsTitle")}</h1>
        <p className="mb-6 text-sm text-slate-400">{t("mentor.settingsSubtitle")}</p>

        <section className="neo-panel space-y-4 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{t("mentor.toggleLabel")}</h2>
              <p className="text-sm text-slate-400">
                {t("mentor.currentStatus")}: {statusLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateMentorEnabled(!mentorEnabled)}
              className={`rounded-lg border px-4 py-2 text-sm transition ${
                mentorEnabled
                  ? "border-brand-green/70 bg-brand-green/10 text-brand-green"
                  : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-brand-blue/50"
              }`}
            >
              {mentorEnabled ? t("mentor.disableAction") : t("mentor.enableAction")}
            </button>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-green">
              {t("mentor.styleLabel")}
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateMentorStyle("supportive")}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  mentorStyle === "supportive"
                    ? "border-brand-green/70 bg-brand-green/10 text-brand-green"
                    : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-brand-blue/50"
                }`}
              >
                {t("mentor.styleSupportive")}
              </button>
              <button
                type="button"
                onClick={() => updateMentorStyle("strict")}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  mentorStyle === "strict"
                    ? "border-brand-green/70 bg-brand-green/10 text-brand-green"
                    : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-brand-blue/50"
                }`}
              >
                {t("mentor.styleStrict")}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
