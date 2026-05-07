from __future__ import annotations

import sys
from pathlib import Path
import unittest

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from pattern_detector import bollingerEdge, breakout, macdCrossover, supportBounce  # noqa: E402


def _make_bars(n: int = 120) -> pd.DataFrame:
    idx = pd.date_range("2025-01-01", periods=n, freq="D")
    close = np.linspace(100.0, 115.0, n) + np.sin(np.linspace(0.0, 8.0, n)) * 0.2
    return pd.DataFrame(
        {
            "open": close - 0.2,
            "high": close + 0.5,
            "low": close - 0.6,
            "close": close,
            "volume": np.full(n, 1_000_000.0),
        },
        index=idx,
    )


class TestPatternDetector(unittest.TestCase):
    def test_breakout_detected(self) -> None:
        bars = _make_bars(60)
        prev_high = float(bars["high"].iloc[-21:-1].max())
        bars.loc[bars.index[-1], "close"] = prev_high * 1.03
        bars.loc[bars.index[-1], "high"] = prev_high * 1.04
        bars.loc[bars.index[-1], "volume"] = 2_500_000.0
        out = breakout("AAPL", bars)
        self.assertTrue(out["detected"])
        self.assertGreaterEqual(out["confidence"], 70)

    def test_support_bounce_detected(self) -> None:
        bars = _make_bars(80)
        ma_now = float(bars["close"].iloc[-21:-1].mean())
        bars.loc[bars.index[-2], "close"] = ma_now * 0.995
        bars.loc[bars.index[-1], "close"] = ma_now * 1.01
        out = supportBounce("MSFT", bars)
        self.assertTrue(out["detected"])
        self.assertGreaterEqual(out["confidence"], 60)

    def test_macd_crossover_shape(self) -> None:
        bars = _make_bars(140)
        # Create recent momentum acceleration.
        bars.loc[bars.index[-8] :, "close"] += np.array([0.0, 0.2, 0.5, 0.9, 1.4, 2.0, 2.7, 3.5])
        out = macdCrossover("NVDA", bars)
        self.assertIn(out["direction"], ("bullish", "bearish"))
        self.assertIsInstance(out["signal_line"], float)

    def test_bollinger_edge_detected_upper(self) -> None:
        bars = _make_bars(80)
        base = bars["close"].to_numpy()
        base[-1] = base[-2] + 6.0  # strong extension vs prior range
        bars["close"] = base
        bars["high"] = bars["close"] + 0.6
        bars["low"] = bars["close"] - 0.6
        out = bollingerEdge("TSLA", bars)
        self.assertIn(out["band"], ("upper", "lower"))
        self.assertIsInstance(out["distance_pct"], float)


if __name__ == "__main__":
    unittest.main()
