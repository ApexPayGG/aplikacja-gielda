"""
Phase 5.1 — Volume anomaly and related market microstructure heuristics.

Expects OHLCV `bars` as a pandas DataFrame with lowercase columns:
`open`, `high`, `low`, `close`, `volume` (index may be datetime).
"""

from __future__ import annotations

from typing import Literal, TypedDict

import numpy as np
import pandas as pd
import talib


class VolumeAnomalyResult(TypedDict):
    is_anomaly: bool
    ratio: float
    level: Literal["quiet", "normal", "elevated", "extreme"]


class VolatilityShiftResult(TypedDict):
    is_shift: bool
    direction: Literal["up", "down", "flat"]
    magnitude: float


class PriceActionResult(TypedDict):
    position: Literal["below_range", "support_zone", "mid", "resistance_zone", "above_range"]
    distance: float


class RsiExtremeResult(TypedDict):
    level: Literal["deep_oversold", "oversold", "neutral", "overbought", "deep_overbought"]
    direction: Literal["bearish", "neutral", "bullish"]


# Tunables (deterministic defaults)
_VOLUME_LOOKBACK = 20
_VOLUME_ANOMALY_RATIO = 2.5
_VOL_SHORT = 5
_VOL_LONG = 20
_VOL_SHIFT_RATIO = 1.35
_RSI_OVERSOLD = 30.0
_RSI_OVERBOUGHT = 70.0
_RSI_DEEP_LOW = 20.0
_RSI_DEEP_HIGH = 80.0


def _require_ohlcv(bars: pd.DataFrame) -> None:
    required = {"open", "high", "low", "close", "volume"}
    cols = {c.lower() for c in bars.columns}
    missing = required - cols
    if missing:
        raise ValueError(f"bars missing columns: {sorted(missing)} (need {sorted(required)})")


def _as_float64(series: pd.Series) -> np.ndarray:
    return np.asarray(series.astype(float), dtype=np.float64)


def volumeAnomaly(ticker: str, bars: pd.DataFrame) -> VolumeAnomalyResult:
    """
    Compare latest bar volume to the trailing mean (excluding the latest bar).

    `ratio` = last_volume / mean(previous `_VOLUME_LOOKBACK` volumes).
    """
    del ticker  # reserved for logging / API symmetry
    _require_ohlcv(bars)
    if len(bars) < _VOLUME_LOOKBACK + 1:
        raise ValueError(f"need at least {_VOLUME_LOOKBACK + 1} rows in bars")

    vol = bars["volume"].astype(float)
    hist = vol.iloc[-(_VOLUME_LOOKBACK + 1) : -1]
    last = float(vol.iloc[-1])
    baseline = float(hist.mean())
    if baseline <= 0:
        ratio = 0.0 if last <= 0 else float("inf")
    else:
        ratio = last / baseline

    is_anomaly = ratio >= _VOLUME_ANOMALY_RATIO

    if ratio < 0.5:
        level: VolumeAnomalyResult["level"] = "quiet"
    elif ratio < 1.25:
        level = "normal"
    elif ratio < _VOLUME_ANOMALY_RATIO:
        level = "elevated"
    else:
        level = "extreme"

    return VolumeAnomalyResult(is_anomaly=is_anomaly, ratio=float(ratio), level=level)


def volatilityShift(ticker: str, bars: pd.DataFrame) -> VolatilityShiftResult:
    """
    Short-window vs long-window realized volatility (std of log returns).
    `magnitude` = short_vol / long_vol (1.0 = no relative change).
    """
    del ticker
    _require_ohlcv(bars)
    min_len = _VOL_LONG + 2
    if len(bars) < min_len:
        raise ValueError(f"need at least {min_len} rows in bars")

    close = bars["close"].astype(float)
    lr = np.log(close / close.shift(1)).dropna()
    if len(lr) < _VOL_LONG:
        raise ValueError("insufficient returns after log-diff")

    short = lr.iloc[-_VOL_SHORT :]
    long = lr.iloc[-_VOL_LONG :]
    s_vol = float(short.std(ddof=1)) if len(short) > 1 else 0.0
    l_vol = float(long.std(ddof=1)) if len(long) > 1 else 0.0

    if l_vol <= 1e-12:
        magnitude = 0.0 if s_vol <= 1e-12 else float("inf")
        is_shift = magnitude >= _VOL_SHIFT_RATIO and np.isfinite(magnitude)
        direction: VolatilityShiftResult["direction"] = "flat"
        return VolatilityShiftResult(is_shift=is_shift, direction=direction, magnitude=magnitude)

    magnitude = s_vol / l_vol
    is_shift = magnitude >= _VOL_SHIFT_RATIO or magnitude <= (1.0 / _VOL_SHIFT_RATIO)

    if magnitude > 1.05:
        direction = "up"
    elif magnitude < 0.95:
        direction = "down"
    else:
        direction = "flat"

    return VolatilityShiftResult(
        is_shift=bool(is_shift),
        direction=direction,
        magnitude=float(magnitude),
    )


def priceAction(
    ticker: str,
    support: float,
    resistance: float,
    *,
    bars: pd.DataFrame | None = None,
    last_close: float | None = None,
) -> PriceActionResult:
    """
    Position of price within [support, resistance]. `distance` is signed distance
    to the nearest boundary as a fraction of range (positive = toward/above resistance).
    """
    del ticker
    if support >= resistance:
        raise ValueError("support must be < resistance")

    if last_close is not None:
        px = float(last_close)
    elif bars is not None:
        _require_ohlcv(bars)
        if len(bars) < 1:
            raise ValueError("bars is empty")
        px = float(bars["close"].iloc[-1])
    else:
        raise ValueError("provide last_close or bars with 'close'")

    rng = resistance - support
    mid = (support + resistance) / 2.0
    band = 0.05 * rng  # 5% of range as "zone" width

    if px < support:
        position: PriceActionResult["position"] = "below_range"
        distance = (px - support) / rng
    elif px > resistance:
        position = "above_range"
        distance = (px - resistance) / rng
    elif px <= support + band:
        position = "support_zone"
        distance = (px - mid) / rng
    elif px >= resistance - band:
        position = "resistance_zone"
        distance = (px - mid) / rng
    else:
        position = "mid"
        distance = (px - mid) / rng

    return PriceActionResult(position=position, distance=float(distance))


def rsiExtreme(ticker: str, period: int, bars: pd.DataFrame) -> RsiExtremeResult:
    """
    Last-bar RSI (TA-Lib) vs 30/70 (deep: 20/80). `bars` must include sufficient history for warmup.

    Note: RSI needs a `close` series; `ticker` is kept for API/logging symmetry with other helpers.
    """
    del ticker
    if period < 2:
        raise ValueError("period must be >= 2")
    _require_ohlcv(bars)
    min_rows = period + 50  # TA-Lib RSI needs warmup; extra margin for NaN tail
    if len(bars) < min_rows:
        raise ValueError(f"need at least ~{min_rows} rows for stable RSI({period})")

    close = _as_float64(bars["close"])
    rsi = talib.RSI(close, timeperiod=period)
    last = float(rsi[-1])
    if np.isnan(last):
        raise ValueError("RSI is NaN — provide more history or check data quality")

    prev = float(rsi[-2]) if len(rsi) > 1 and not np.isnan(rsi[-2]) else last

    if last <= _RSI_DEEP_LOW:
        level: RsiExtremeResult["level"] = "deep_oversold"
    elif last < _RSI_OVERSOLD:
        level = "oversold"
    elif last >= _RSI_DEEP_HIGH:
        level = "deep_overbought"
    elif last > _RSI_OVERBOUGHT:
        level = "overbought"
    else:
        level = "neutral"

    if last > prev + 0.5:
        direction: RsiExtremeResult["direction"] = "bullish"
    elif last < prev - 0.5:
        direction = "bearish"
    else:
        direction = "neutral"

    return RsiExtremeResult(level=level, direction=direction)


__all__ = [
    "VolumeAnomalyResult",
    "VolatilityShiftResult",
    "PriceActionResult",
    "RsiExtremeResult",
    "volumeAnomaly",
    "volatilityShift",
    "priceAction",
    "rsiExtreme",
]
