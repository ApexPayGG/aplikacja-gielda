import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckBadgeIcon, LockClosedIcon, SparklesIcon } from "@heroicons/react/24/solid";
import {
  checkSkillTree,
  getSkillTree,
  type SkillTreeResponse,
  type SkillTreeSkillId,
} from "../services/api";
import {
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_DANGER_PANEL,
  TERMINAL_INFO_BANNER,
  TERMINAL_PAGE_TITLE,
  TERMINAL_TOOL_GRID,
  TERMINAL_TOOL_PAGE,
  TERMINAL_TOOL_PAGE_INNER,
  TERMINAL_TOOL_PANEL,
} from "../components/terminal/terminalStyles";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { resolveIntlLocale } from "../utils/formatters";

const USER_ID = window.localStorage.getItem("userId")?.trim() || "";
const TOTAL_SKILLS = 10;

function formatDate(value: string | null, locale: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(resolveIntlLocale(locale), { year: "numeric", month: "short", day: "numeric" });
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
    <div className={TERMINAL_TOOL_PAGE}>
      <div className={TERMINAL_TOOL_PAGE_INNER}>
        <header className={`mb-8 ${TERMINAL_TOOL_PANEL}`}>
          <h1 className={TERMINAL_PAGE_TITLE}>Skill Tree</h1>
          <p className="mt-1 text-sm text-terminal-textMuted">{t("skilltree.subtitle")}</p>
        </header>

        {error ? <div className={`mb-6 ${TERMINAL_DANGER_PANEL}`}>{error}</div> : null}

        {loading ? (
          <p className="text-terminal-textMuted">{t("common.loading")}</p>
        ) : data ? (
          <>
            <section className={`mb-6 ${TERMINAL_TOOL_PANEL}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-terminal-text">XP Progress</p>
                  <p className="text-xs text-terminal-textMuted">
                    {t("skilltree.progressLabel", {
                      unlocked: data.totalUnlocked,
                      total: data.totalSkills || TOTAL_SKILLS,
                    })}
                  </p>
                </div>
                <button type="button" onClick={onCheckProgress} disabled={checking} className={TERMINAL_BUTTON_PRIMARY}>
                  {checking ? t("common.loading") : t("skilltree.checkProgress")}
                </button>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-terminal-panelSecondary">
                <div
                  className="h-full rounded-full bg-terminal-cyan transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </section>

            {newlyUnlocked.length > 0 ? (
              <section className={`mb-6 ${TERMINAL_INFO_BANNER}`}>
                <div className="mb-2 flex items-center gap-2 text-terminal-text">
                  <SparklesIcon className="h-5 w-5 text-terminal-cyan" aria-hidden />
                  <p className="font-semibold">{t("skilltree.celebrationTitle")}</p>
                </div>
                <p className="mb-2 text-sm text-terminal-textMuted">{t("skilltree.newlyUnlockedLabel")}</p>
                <ul className="space-y-1 text-sm text-terminal-textSecondary">
                  {newlyUnlocked.map((skillId) => (
                    <li key={skillId}>• {t(`skilltree.skills.${skillId}.name`)}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className={TERMINAL_TOOL_GRID}>
              {data.skills.map((skill, index) => {
                const unlocked = skill.unlocked;
                const inProgress = !unlocked && index === firstLockedIndex;
                const cardClass = unlocked
                  ? "border-terminal-borderMuted bg-terminal-panelSecondary/80"
                  : inProgress
                    ? "border-2 border-terminal-cyan bg-terminal-cyan/5"
                    : "border-terminal-borderMuted bg-terminal-panelSecondary/40 opacity-80";
                const iconClass = unlocked
                  ? "bg-terminal-cyan/15 text-terminal-cyan"
                  : inProgress
                    ? "border border-terminal-cyan bg-terminal-cyan/10 text-terminal-cyan"
                    : "bg-terminal-panelSecondary text-terminal-textMuted";

                return (
                  <article
                    key={skill.id}
                    className={`rounded-lg border p-5 shadow-terminal-panel ${cardClass}`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${iconClass}`}>
                          {skill.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-base font-semibold text-terminal-text">
                            {t(`skilltree.skills.${skill.id}.name`, { defaultValue: skill.name })}
                          </h2>
                          {unlocked ? (
                            <span className="text-xs font-semibold text-terminal-positive">Unlocked</span>
                          ) : inProgress ? (
                            <span className="text-xs font-semibold text-terminal-cyan">In progress</span>
                          ) : (
                            <span className="text-xs font-semibold text-terminal-textMuted">Locked</span>
                          )}
                        </div>
                      </div>

                      {unlocked ? (
                        <CheckBadgeIcon className="h-6 w-6 shrink-0 text-terminal-cyan" aria-hidden />
                      ) : (
                        <LockClosedIcon className="h-6 w-6 shrink-0 text-terminal-textMuted" aria-hidden />
                      )}
                    </div>

                    <p className={`text-sm ${unlocked ? "text-terminal-textMuted" : "text-terminal-textMuted/80"}`}>
                      {t(`skilltree.skills.${skill.id}.description`, {
                        defaultValue: skill.description,
                      })}
                    </p>

                    <div className="mt-4 text-xs">
                      {unlocked ? (
                        <p className="text-terminal-positive">
                          {t("skilltree.unlockedAt", {
                            date: formatDate(skill.unlockedAt, i18n.language || "en"),
                          })}
                        </p>
                      ) : (
                        <p className="text-terminal-textMuted">
                          {t(`skilltree.skills.${skill.id}.condition`, {
                            defaultValue: skill.unlockCondition,
                          })}
                        </p>
                      )}
                    </div>

                    {inProgress ? (
                      <div className="mt-4">
                        <div className="mb-1 flex items-center justify-between text-xs text-terminal-cyan">
                          <span>Progress</span>
                          <span>{progressPct}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-terminal-panelSecondary">
                          <div
                            className="h-full rounded-full bg-terminal-cyan"
                            style={{
                              width: `${Math.max(12, Math.min(92, progressPct))}%`,
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
