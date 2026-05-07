from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from anomaly_detector import priceAction, rsiExtreme, volatilityShift, volumeAnomaly  # noqa: E402


def make_demo_bars(n: int = 140) -> pd.DataFrame:
    idx = pd.date_range("2025-01-01", periods=n, freq="D")
    trend = np.linspace(100.0, 130.0, n)
    wobble = np.sin(np.linspace(0.0, 20.0, n)) * 1.25
    close = trend + wobble
    bars = pd.DataFrame(
        {
            "open": close - 0.3,
            "high": close + 0.9,
            "low": close - 1.0,
            "close": close,
            "volume": np.full(n, 1_200_000.0),
        },
        index=idx,
    )
    bars.loc[bars.index[-1], "volume"] = 3_900_000.0
    return bars


def main() -> None:
    bars = make_demo_bars()
    ticker = "AAPL"

    print("volumeAnomaly:", volumeAnomaly(ticker, bars))
    print("volatilityShift:", volatilityShift(ticker, bars))
    print("priceAction:", priceAction(ticker, support=110.0, resistance=135.0, bars=bars))
    print("rsiExtreme:", rsiExtreme(ticker, period=14, bars=bars))


if __name__ == "__main__":
    main()
