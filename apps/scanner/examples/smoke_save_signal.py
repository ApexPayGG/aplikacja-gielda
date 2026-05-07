from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from db import saveSignal  # noqa: E402


def main() -> None:
    signal_id = saveSignal(
        ticker="AAPL",
        pattern_type="breakout",
        confidence=82,
        technical_data={
            "rsi": 63.2,
            "macd": 1.14,
            "volume_ratio": 2.35,
            "support_level": 184.5,
        },
        backtest_data={
            "exchange": "NASDAQ",
            "historical_count": 47,
            "win_rate": 61.7,
            "avg_return_10d": 2.9,
            "max_drawdown": -3.2,
            "user_triggered": True,
        },
    )
    print(f"saved signal id: {signal_id}")


if __name__ == "__main__":
    main()

