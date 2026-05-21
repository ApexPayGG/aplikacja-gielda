import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckBadgeIcon, LockClosedIcon, SparklesIcon } from "@heroicons/react/24/solid";
import {
  checkSkillTree,
  getSkillTree,
  type SkillTreeResponse,
  type SkillTreeSkillId,
} from "../services/api";
import { colors } from "../styles/designSystem";
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

  const firstLockedIndex = useMemo(() => {
    if (!data) return -1;
    return data.skills.findIndex((skill) => !skill.unlocked);
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
    <div className="min-h-screen bg-gradient-to-b from-[#0a0b14] via-[#1e1b4b]/90 to-[#0a0b14]">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8 glass-section rounded-3xl border border-white/10 p-6 shadow-[0_16px_36px_rgba(168,85,247,0.08)]">
          <h1 className="glass-page-title text-3xl">Skill Tree</h1>
          <p className="mt-1 glass-muted text-sm">{t("skilltree.subtitle")}</p>
        </header>

        {error ? (
          <div className="mb-6 rounded-xl border border-negative/25 bg-negative/10 p-3 text-sm text-negative">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="glass-muted">{t("common.loading")}</p>
        ) : data ? (
          <>
            <section className="mb-6 glass-section rounded-2xl p-5 shadow-[0_14px_30px_rgba(168,85,247,0.08)]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">XP Progress</p>
                  <p className="text-xs glass-muted">
                    {t("skilltree.progressLabel", {
                      unlocked: data.totalUnlocked,
                      total: data.totalSkills || TOTAL_SKILLS,
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCheckProgress}
                  disabled={checking}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                  style={{ background: `linear-gradient(120deg, ${colors.brandDark}, ${colors.brandMedium})` }}
                >
                  {checking ? t("common.loading") : t("skilltree.checkProgress")}
                </button>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, backgroundColor: colors.brandCyan }}
                />
              </div>
            </section>

            {newlyUnlocked.length > 0 ? (
              <section className="mb-6 rounded-2xl border border-brandCyan/35 bg-brandCyan/10 p-5">
                <div className="mb-2 flex items-center gap-2 text-white">
                  <SparklesIcon className="h-5 w-5" aria-hidden />
                  <p className="font-semibold">{t("skilltree.celebrationTitle")}</p>
                </div>
                <p className="mb-2 glass-muted text-sm">{t("skilltree.newlyUnlockedLabel")}</p>
                <ul className="space-y-1 text-sm text-white">
                  {newlyUnlocked.map((skillId) => (
                    <li key={skillId}>• {t(`skilltree.skills.${skillId}.name`)}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.skills.map((skill, index) => {
                const unlocked = skill.unlocked;
                const inProgress = !unlocked && index === firstLockedIndex;
                const cardClass = unlocked
                  ? "border-white/10 bg-white/[0.04]"
                  : inProgress
                    ? "border-2 border-brandCyan bg-white/[0.06]"
                    : "border-white/10 bg-white/[0.03]";
                const iconClass = unlocked
                  ? "bg-brandCyan/15 text-white"
                  : inProgress
                    ? "border border-brandCyan bg-brandCyan/10 text-brandCyan"
                    : "bg-white/10 text-white/50";

                return (
                  <article
                    key={skill.id}
                    className={`rounded-2xl border p-5 shadow-[0_10px_24px_rgba(168,85,247,0.07)] ${cardClass}`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${iconClass}`}>
                          {skill.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <h2 className={`text-base font-semibold ${unlocked ? "text-white" : "text-white"}`}>
                            {t(`skilltree.skills.${skill.id}.name`, { defaultValue: skill.name })}
                          </h2>
                          {unlocked ? (
                            <span className="text-xs font-semibold text-positive">Unlocked</span>
                          ) : inProgress ? (
                            <span className="text-xs font-semibold text-brandCyan">In progress</span>
                          ) : (
                            <span className="text-xs font-semibold text-white/50">Locked</span>
                          )}
                        </div>
                      </div>

                      {unlocked ? (
                        <CheckBadgeIcon className="h-6 w-6 shrink-0 text-brandCyan" aria-hidden />
                      ) : (
                        <LockClosedIcon className="h-6 w-6 shrink-0 text-white/50" aria-hidden />
                      )}
                    </div>

                    <p className={`text-sm ${unlocked ? "glass-muted" : "text-white/50"}`}>
                      {t(`skilltree.skills.${skill.id}.description`, {
                        defaultValue: skill.description,
                      })}
                    </p>

                    <div className="mt-4 text-xs">
                      {unlocked ? (
                        <p className="text-positive">
                          {t("skilltree.unlockedAt", {
                            date: formatDate(skill.unlockedAt, i18n.language || "en"),
                          })}
                        </p>
                      ) : (
                        <p className="glass-muted">
                          {t(`skilltree.skills.${skill.id}.condition`, {
                            defaultValue: skill.unlockCondition,
                          })}
                        </p>
                      )}
                    </div>

                    {inProgress ? (
                      <div className="mt-4">
                        <div className="mb-1 flex items-center justify-between text-xs text-brandCyan">
                          <span>Progress</span>
                          <span>{progressPct}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(12, Math.min(92, progressPct))}%`,
                              backgroundColor: colors.brandCyan,
                            }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
