"""Service configuration via env vars."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    quant_service_host: str = "0.0.0.0"
    quant_service_port: int = 8012
    quant_service_enabled: bool = True
    trading_lab_paper_only: bool = True
    trading_lab_max_backtest_rows: int = 50_000
    trading_lab_default_fees_bps: float = 10.0
    trading_lab_default_slippage_bps: float = 5.0
    trading_lab_allow_experimental_strategies: bool = True

    model_config = {"env_prefix": "", "case_sensitive": False}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
