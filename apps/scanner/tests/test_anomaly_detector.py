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

from anomaly_detector import priceAction, rsiExtreme, volatilityShift, volumeAnomaly  # noqa: E402


def _make_bars(n: int = 120) -> pd.DataFrame:
    idx = pd.date_range("2025-01-01", periods=n, freq="D")
    base = np.linspace(100.0, 120.0, n)
    noise = np.sin(np.linspace(0.0, 8.0, n)) * 0.5
    close = base + noise
    return pd.DataFrame(
        {
            "open": close - 0.2,
            "high": close + 0.6,
            "low": close - 0.7,
            "close": close,
            "volume": np.full(n, 1_000_000.0),
        },
        index=idx,
    )


class TestAnomalyDetector(unittest.TestCase):
    def test_volume_anomaly_detects_spike(self) -> None:
        bars = _make_bars(40)
        bars.loc[bars.index[-1], "volume"] = 4_000_000.0
        out = volumeAnomaly("AAPL", bars)
        self.assertTrue(out["is_anomaly"])
        self.assertGreater(out["ratio"], 2.5)
        self.assertEqual(out["level"], "extreme")

    def test_volatility_shift_returns_shape(self) -> None:
        bars = _make_bars(80)
        bars.loc[bars.index[-8] :, "close"] += np.array([0, 1.2, -1.1, 1.5, -1.4, 1.8, -1.6, 2.0])
        out = volatilityShift("MSFT", bars)
        self.assertIn(out["direction"], ("up", "down", "flat"))
        self.assertGreaterEqual(out["magnitude"], 0.0)

    def test_price_action_support_zone(self) -> None:
        out = priceAction("KO", support=95.0, resistance=105.0, last_close=95.2)
        self.assertEqual(out["position"], "support_zone")
        self.assertLess(out["distance"], 0.0)

    def test_rsi_extreme_shape(self) -> None:
        bars = _make_bars(120)
        out = rsiExtreme("NVDA", period=14, bars=bars)
        self.assertIn(out["level"], ("deep_oversold", "oversold", "neutral", "overbought", "deep_overbought"))
        self.assertIn(out["direction"], ("bearish", "neutral", "bullish"))


if __name__ == "__main__":
    unittest.main()
