import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckBadgeIcon, LockClosedIcon, SparklesIcon } from "@heroicons/react/24/solid";
import {
  checkSkillTree,
  getSkillTree,
  type SkillTreeResponse,
  type SkillTreeSkillId,
} from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = window.localStorage.getItem("userId")?.trim() || "";
const TOTAL_SKILLS = 10;

function formatDate(value: string | null, locale: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

export function SkillTreePage() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<SkillTreeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newlyUnlocked, setNewlyUnlocked] = useState<SkillTreeSkillId[]>([]);

  async function loadSkillTree() {
    const result = await getSkillTree(USER_ID);
    setData(result);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getSkillTree(USER_ID);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError(apiErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const progressPct = useMemo(() => {
    if (!data) return 0;
    return Math.round((data.totalUnlocked / Math.max(1, data.totalSkills)) * 100);
  }, [data]);

  async function onCheckProgress() {
    setChecking(true);
    setError(null);
    try {
      const check = await checkSkillTree(USER_ID);
      setNewlyUnlocked(check.newlyUnlocked);
      await loadSkillTree();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">{t("skilltree.title")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("skilltree.subtitle")}</p>
      </header>

      {error ? (
        <div className="mb-6 rounded-lg border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : data ? (
        <>
          <section className="neo-panel mb-6 rounded-2xl p-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">
                {t("skilltree.progressLabel", {
                  unlocked: data.totalUnlocked,
                  total: data.totalSkills || TOTAL_SKILLS,
                })}
              </p>
              <button
                type="button"
                onClick={onCheckProgress}
                disabled={checking}
                className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue/85 disabled:opacity-60"
              >
                {checking ? t("common.loading") : t("skilltree.checkProgress")}
              </button>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-brand-border/60">
              <div
                className="h-full rounded-full bg-brand-green transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </section>

          {newlyUnlocked.length > 0 ? (
            <section className="neo-panel mb-6 rounded-2xl border border-brand-green/40 bg-brand-green/10 p-5">
              <div className="mb-2 flex items-center gap-2 text-brand-green">
                <SparklesIcon className="h-5 w-5 animate-bounce" aria-hidden />
                <p className="font-semibold">{t("skilltree.celebrationTitle")}</p>
              </div>
              <p className="mb-2 text-sm text-slate-200">{t("skilltree.newlyUnlockedLabel")}</p>
              <ul className="space-y-1 text-sm text-slate-100">
                {newlyUnlocked.map((skillId) => (
                  <li key={skillId}>• {t(`skilltree.skills.${skillId}.name`)}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.skills.map((skill) => {
              const unlocked = skill.unlocked;
              return (
                <article
                  key={skill.id}
                  className={`rounded-2xl border p-5 ${
                    unlocked
                      ? "border-brand-green/40 bg-brand-green/10"
                      : "border-slate-600/50 bg-slate-800/60"
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold text-white">
                      {t(`skilltree.skills.${skill.id}.name`, { defaultValue: skill.name })}
                    </h2>
                    {unlocked ? (
                      <CheckBadgeIcon className="h-6 w-6 shrink-0 text-brand-green" aria-hidden />
                    ) : (
                      <LockClosedIcon className="h-6 w-6 shrink-0 text-slate-400" aria-hidden />
                    )}
                  </div>

                  <p className="text-sm text-slate-200">
                    {t(`skilltree.skills.${skill.id}.description`, {
                      defaultValue: skill.description,
                    })}
                  </p>

                  <div className="mt-4 text-xs">
                    {unlocked ? (
                      <p className="text-brand-green">
                        {t("skilltree.unlockedAt", {
                          date: formatDate(skill.unlockedAt, i18n.language || "en"),
                        })}
                      </p>
                    ) : (
                      <p className="text-slate-400">
                        {t(`skilltree.skills.${skill.id}.condition`, {
                          defaultValue: skill.unlockCondition,
                        })}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        </>
      ) : null}
    </div>
  );
}
