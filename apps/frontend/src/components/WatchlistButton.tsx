import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { addToWatchlist, getWatchlist, removeFromWatchlist } from "../services/api";

const watchlistCache = new Map<string, Set<string>>();
const watchlistLoading = new Map<string, Promise<Set<string>>>();

function normalizeSymbol(symbolRaw: string): string {
  return symbolRaw.trim().toUpperCase();
}

async function loadWatchlistSymbols(userId: string): Promise<Set<string>> {
  const cached = watchlistCache.get(userId);
  if (cached) return new Set(cached);

  const inFlight = watchlistLoading.get(userId);
  if (inFlight) return inFlight.then((symbols) => new Set(symbols));

  const request = getWatchlist(userId)
    .then((rows) => {
      const symbols = new Set(rows.map((row) => normalizeSymbol(row.symbol)));
      watchlistCache.set(userId, symbols);
      watchlistLoading.delete(userId);
      return symbols;
    })
    .catch((error) => {
      watchlistLoading.delete(userId);
      throw error;
    });

  watchlistLoading.set(userId, request);
  return request.then((symbols) => new Set(symbols));
}

type Props = {
  symbol: string;
  className?: string;
};

export function WatchlistButton({ symbol, className }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const normalizedSymbol = useMemo(() => normalizeSymbol(symbol), [symbol]);

  const [isWatched, setIsWatched] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id || !normalizedSymbol) {
      setIsWatched(false);
      return;
    }

    let cancelled = false;
    void loadWatchlistSymbols(user.id)
      .then((symbols) => {
        if (!cancelled) {
          setIsWatched(symbols.has(normalizedSymbol));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsWatched(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedSymbol, user?.id]);

  const handleToggle = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!user?.id) {
      navigate("/register");
      return;
    }

    if (!normalizedSymbol || loading) return;

    setLoading(true);
    try {
      if (isWatched) {
        await removeFromWatchlist(user.id, normalizedSymbol);
        const symbols = watchlistCache.get(user.id) ?? new Set<string>();
        symbols.delete(normalizedSymbol);
        watchlistCache.set(user.id, symbols);
        setIsWatched(false);
      } else {
        await addToWatchlist(user.id, normalizedSymbol);
        const symbols = watchlistCache.get(user.id) ?? new Set<string>();
        symbols.add(normalizedSymbol);
        watchlistCache.set(user.id, symbols);
        setIsWatched(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const baseClass =
    "rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60";
  const watchedClass = isWatched
    ? "border-rose-400/60 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
    : "border-slate-600 bg-slate-900/50 text-slate-200 hover:border-rose-400/50 hover:text-rose-200";

  return (
    <button type="button" onClick={handleToggle} disabled={loading} className={`${baseClass} ${watchedClass} ${className ?? ""}`}>
      {isWatched
        ? t("watchlist.following", { defaultValue: "♥ Observed" })
        : t("watchlist.follow", { defaultValue: "♡ Follow" })}
    </button>
  );
}
