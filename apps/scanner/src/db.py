"""
Minimal DB helper for persisting scanner signals into PostgreSQL.

Requires `DATABASE_URL` env (PostgreSQL DSN).
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

import psycopg


def _require_non_empty_str(name: str, value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{name} is required and must be a non-empty string")
    return value.strip()


def _coerce_confidence(value: Any) -> int:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError("confidence is required and must be a number in 0..100")
    out = int(round(float(value)))
    if out < 0 or out > 100:
        raise ValueError("confidence must be in range 0..100")
    return out


def _ensure_mapping(name: str, value: Any) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ValueError(f"{name} must be a dict-like mapping")
    return value


def saveSignal(
    ticker: str,
    pattern_type: str,
    confidence: int,
    technical_data: Mapping[str, Any],
    backtest_data: Mapping[str, Any],
) -> str:
    """
    Persist one signal row and return created `id`.

    Required:
    - ticker
    - pattern_type
    - confidence (0-100)
    - technical_data (dict)
    - backtest_data with key `exchange`
    """
    dsn = os.getenv("DATABASE_URL", "").strip()
    if not dsn:
        raise ValueError("DATABASE_URL env is required")

    ticker_norm = _require_non_empty_str("ticker", ticker).upper()
    pattern_norm = _require_non_empty_str("pattern_type", pattern_type)
    conf = _coerce_confidence(confidence)
    tech = _ensure_mapping("technical_data", technical_data)
    back = _ensure_mapping("backtest_data", backtest_data)
    exchange = _require_non_empty_str("backtest_data.exchange", back.get("exchange"))

    historical_count = back.get("historical_count")
    win_rate = back.get("win_rate")
    avg_return_10d = back.get("avg_return_10d")
    max_drawdown = back.get("max_drawdown")
    user_triggered = bool(back.get("user_triggered", False))

    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    tech_json = json.dumps(dict(tech), ensure_ascii=False)

    sql = """
        INSERT INTO "Signal" (
            ticker, exchange, pattern_type, confidence, technical_data,
            historical_count, win_rate, avg_return_10d, max_drawdown,
            expires_at, user_triggered
        )
        VALUES (
            %(ticker)s, %(exchange)s, %(pattern_type)s, %(confidence)s, %(technical_data)s::jsonb,
            %(historical_count)s, %(win_rate)s, %(avg_return_10d)s, %(max_drawdown)s,
            %(expires_at)s, %(user_triggered)s
        )
        RETURNING id
    """

    params = {
        "ticker": ticker_norm,
        "exchange": exchange,
        "pattern_type": pattern_norm,
        "confidence": conf,
        "technical_data": tech_json,
        "historical_count": historical_count,
        "win_rate": win_rate,
        "avg_return_10d": avg_return_10d,
        "max_drawdown": max_drawdown,
        "expires_at": expires_at,
        "user_triggered": user_triggered,
    }

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            if row is None:
                raise RuntimeError("insert failed: no id returned")
            return str(row[0])

