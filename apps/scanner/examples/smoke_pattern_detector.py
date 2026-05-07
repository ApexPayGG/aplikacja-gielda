from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from pattern_detector import bollingerEdge, breakout, macdCrossover, supportBounce  # noqa: E402


def make_demo_bars(n: int = 140) -> pd.DataFrame:
    idx = pd.date_range("2025-01-01", periods=n, freq="D")
    trend = np.linspace(90.0, 120.0, n)
    wobble = np.sin(np.linspace(0.0, 14.0, n)) * 0.8
    close = trend + wobble
    bars = pd.DataFrame(
        {
            "open": close - 0.25,
            "high": close + 0.7,
            "low": close - 0.8,
            "close": close,
            "volume": np.full(n, 900_000.0),
        },
        index=idx,
    )
    # Inject a recent breakout-like bar.
    bars.loc[bars.index[-1], "close"] = float(bars["high"].iloc[-21:-1].max()) * 1.02
    bars.loc[bars.index[-1], "high"] = bars.loc[bars.index[-1], "close"] + 0.4
    bars.loc[bars.index[-1], "volume"] = 2_200_000.0
    return bars


def main() -> None:
    ticker = "AAPL"
    bars = make_demo_bars()
    print("breakout:", breakout(ticker, bars))
    print("supportBounce:", supportBounce(ticker, bars))
    print("macdCrossover:", macdCrossover(ticker, bars))
    print("bollingerEdge:", bollingerEdge(ticker, bars))


if __name__ == "__main__":
    main()
