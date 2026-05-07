"""
Phase 5.1 — Pattern detection helpers (deterministic, no AI).

Expected input `bars`: pandas DataFrame with lowercase OHLCV columns:
`open`, `high`, `low`, `close`, `volume`.
"""

from __future__ import annotations

from typing import Literal, TypedDict

import numpy as np
import pandas as pd
import talib


class BreakoutResult(TypedDict):
    detected: bool
    confidence: int
    level: float


class SupportBounceResult(TypedDict):
    detected: bool
    confidence: int
    ma_level: float


class MacdCrossoverResult(TypedDict):
    detected: bool
    direction: Literal["bullish", "bearish"]
    signal_line: float


class BollingerEdgeResult(TypedDict):
    detected: bool
    band: Literal["upper", "lower"]
    distance_pct: float


_LOOKBACK = 20
_VOL_MULT = 2.0


def _require_ohlcv(bars: pd.DataFrame) -> None:
    required = {"open", "high", "low", "close", "volume"}
    cols = {c.lower() for c in bars.columns}
    missing = required - cols
    if missing:
        raise ValueError(f"bars missing columns: {sorted(missing)} (need {sorted(required)})")


def _close_np(bars: pd.DataFrame) -> np.ndarray:
    return np.asarray(bars["close"].astype(float), dtype=np.float64)


def breakout(ticker: str, bars: pd.DataFrame) -> BreakoutResult:
    """
    Breakout when latest close > prior 20-day high and latest volume > 2x avg(20).
    """
    del ticker
    _require_ohlcv(bars)
    if len(bars) < _LOOKBACK + 1:
        raise ValueError(f"need at least {_LOOKBACK + 1} rows in bars")

    close = bars["close"].astype(float)
    high = bars["high"].astype(float)
    volume = bars["volume"].astype(float)

    prev_high_20 = float(high.iloc[-(_LOOKBACK + 1) : -1].max())
    avg_vol_20 = float(volume.iloc[-(_LOOKBACK + 1) : -1].mean())
    last_close = float(close.iloc[-1])
    last_vol = float(volume.iloc[-1])

    price_ok = last_close > prev_high_20
    vol_ratio = (last_vol / avg_vol_20) if avg_vol_20 > 0 else 0.0
    vol_ok = vol_ratio > _VOL_MULT
    detected = price_ok and vol_ok

    # Weighted confidence: price break strength 60%, volume expansion 40%.
    price_strength = max(0.0, (last_close - prev_high_20) / max(prev_high_20, 1e-12))
    price_score = min(100.0, price_strength * 1200.0)  # +8.3% ~= 100
    vol_score = min(100.0, max(0.0, (vol_ratio - 1.0) * 100.0))  # 2x -> 100
    confidence = int(round(0.6 * price_score + 0.4 * vol_score))
    if detected:
        confidence = max(confidence, 70)

    return BreakoutResult(detected=detected, confidence=max(0, min(100, confidence)), level=prev_high_20)


def supportBounce(ticker: str, bars: pd.DataFrame) -> SupportBounceResult:
    """
    Bounce pattern: previous bar dipped below MA20, latest close back above MA20.
    """
    del ticker
    _require_ohlcv(bars)
    if len(bars) < _LOOKBACK + 2:
        raise ValueError(f"need at least {_LOOKBACK + 2} rows in bars")

    close = bars["close"].astype(float)
    ma20 = close.rolling(_LOOKBACK).mean()

    prev_close = float(close.iloc[-2])
    last_close = float(close.iloc[-1])
    prev_ma = float(ma20.iloc[-2])
    last_ma = float(ma20.iloc[-1])
    if np.isnan(prev_ma) or np.isnan(last_ma):
        raise ValueError("MA20 unavailable; provide more history")

    dipped = prev_close < prev_ma
    recovered = last_close > last_ma
    detected = dipped and recovered

    rebound = max(0.0, (last_close - last_ma) / max(last_ma, 1e-12))
    dip_depth = max(0.0, (prev_ma - prev_close) / max(prev_ma, 1e-12))
    conf = int(round(min(100.0, (rebound * 900.0 + dip_depth * 700.0))))
    if detected:
        conf = max(conf, 65)

    return SupportBounceResult(detected=detected, confidence=max(0, min(100, conf)), ma_level=last_ma)


def macdCrossover(ticker: str, bars: pd.DataFrame) -> MacdCrossoverResult:
    """
    Bullish crossover when MACD crosses above signal on latest bar.
    """
    del ticker
    _require_ohlcv(bars)
    if len(bars) < 60:
        raise ValueError("need at least 60 rows for stable MACD")

    close = _close_np(bars)
    macd, signal, _hist = talib.MACD(close, fastperiod=12, slowperiod=26, signalperiod=9)
    if len(macd) < 2 or np.isnan(macd[-1]) or np.isnan(signal[-1]) or np.isnan(macd[-2]) or np.isnan(signal[-2]):
        raise ValueError("MACD contains NaN; provide more history")

    prev_diff = float(macd[-2] - signal[-2])
    last_diff = float(macd[-1] - signal[-1])
    bullish_cross = prev_diff <= 0 and last_diff > 0
    bearish_cross = prev_diff >= 0 and last_diff < 0
    direction: Literal["bullish", "bearish"] = "bullish" if last_diff >= 0 else "bearish"

    return MacdCrossoverResult(
        detected=bool(bullish_cross or bearish_cross),
        direction=direction,
        signal_line=float(signal[-1]),
    )


def bollingerEdge(ticker: str, bars: pd.DataFrame) -> BollingerEdgeResult:
    """
    Edge detection for Bollinger(20,2): close touching/breaking upper or lower band.
    """
    del ticker
    _require_ohlcv(bars)
    if len(bars) < 40:
        raise ValueError("need at least 40 rows for stable Bollinger Bands")

    close = _close_np(bars)
    upper, middle, lower = talib.BBANDS(close, timeperiod=20, nbdevup=2, nbdevdn=2, matype=0)
    last_close = float(close[-1])
    u = float(upper[-1])
    l = float(lower[-1])
    m = float(middle[-1])
    if np.isnan(u) or np.isnan(l) or np.isnan(m):
        raise ValueError("Bollinger Bands contain NaN; provide more history")

    dist_upper = ((last_close - u) / max(abs(u), 1e-12)) * 100.0
    dist_lower = ((l - last_close) / max(abs(l), 1e-12)) * 100.0

    if abs(dist_upper) <= abs(dist_lower):
        band: Literal["upper", "lower"] = "upper"
        distance_pct = dist_upper
        detected = last_close >= u
    else:
        band = "lower"
        distance_pct = dist_lower
        detected = last_close <= l

    return BollingerEdgeResult(detected=detected, band=band, distance_pct=float(distance_pct))


__all__ = [
    "BreakoutResult",
    "SupportBounceResult",
    "MacdCrossoverResult",
    "BollingerEdgeResult",
    "breakout",
    "supportBounce",
    "macdCrossover",
    "bollingerEdge",
]
