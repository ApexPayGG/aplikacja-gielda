import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getSignalReactions,
  getTradeReactions,
  postSignalReaction,
  postTradeReaction,
  type TradeReactionItem,
} from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { formatLocaleDateTime } from "../utils/formatters";

const MAX_LEN = 500;

type Props =
  | { variant: "trade"; tradeId: string; userId: string }
  | { variant: "signal"; signalId: string; userId: string };

export function ReactionSection(props: Props) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<TradeReactionItem[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetKey = props.variant === "trade" ? props.tradeId : props.signalId;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next =
        props.variant === "trade"
          ? await getTradeReactions(props.tradeId)
          : await getSignalReactions(props.signalId);
      setItems(next);
    } catch (e) {
      setError(apiErrorMessage(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [props]);

  useEffect(() => {
    void load();
  }, [load, targetKey]);

  const trimmed = text.trim();
  const len = text.length;
  const canPost = trimmed.length > 0 && len <= MAX_LEN && !posting;

  async function onPost(): Promise<void> {
    if (!canPost) return;
    setPosting(true);
    setError(null);
    try {
      if (props.variant === "trade") {
        await postTradeReaction({ userId: props.userId, tradeId: props.tradeId, content: trimmed });
      } else {
        await postSignalReaction({ userId: props.userId, signalId: props.signalId, content: trimmed });
      }
      setText("");
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-800 bg-brand-bg/50 p-3">
      <h4 className="mb-2 text-sm font-semibold text-slate-200">{t("reactions.title")}</h4>
      {loading ? (
        <p className="text-xs text-slate-500">{t("reactions.loading")}</p>
      ) : items.length === 0 ? (
        <p className="mb-2 text-xs text-slate-500">{t("reactions.empty")}</p>
      ) : (
        <ul className="mb-3 max-h-48 space-y-2 overflow-y-auto text-sm">
          {items.map((r) => (
            <li key={r.id} className="rounded border border-slate-800/80 bg-slate-900/40 px-2 py-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-slate-500">
                <span className="font-mono text-slate-400">{r.userId}</span>
                <time dateTime={r.createdAt} className="shrink-0">
                  {formatLocaleDateTime(r.createdAt, i18n.language)}
                </time>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-slate-200">{r.content}</p>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="mb-2 text-xs text-brand-red">{error}</p> : null}
      <label className="block text-xs text-slate-400">
        <textarea
          className="mt-1 w-full resize-y rounded border border-brand-border bg-brand-bg px-2 py-2 text-sm text-white outline-none focus:border-brand-blue"
          rows={3}
          maxLength={MAX_LEN}
          placeholder={t("reactions.placeholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={posting}
        />
        <span className="mt-1 block text-right text-slate-500">
          {t("reactions.charCount", { used: len, max: MAX_LEN })}
        </span>
      </label>
      <button
        type="button"
        disabled={!canPost}
        onClick={() => void onPost()}
        className="interactive-tilt mt-2 rounded bg-brand-amber px-3 py-1.5 text-xs font-semibold text-brand-bg transition hover:bg-brand-amber/85 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {posting ? t("reactions.posting") : t("reactions.postComment")}
      </button>
    </div>
  );
}
