"""
Hypothesis profiles.
  dev (default): a few hundred cases per property, for local runs.
  ci           : the full counts (10,000 for closed forms and tax, 5,000 for root-finding).
Select with HYPOTHESIS_PROFILE=ci.
"""
import os
import sys
from pathlib import Path

from hypothesis import HealthCheck, settings

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

COMMON = dict(deadline=None, suppress_health_check=[HealthCheck.too_slow, HealthCheck.data_too_large], print_blob=True)
settings.register_profile("dev", max_examples=200, **COMMON)
settings.register_profile("ci", max_examples=10_000, **COMMON)
settings.load_profile(os.environ.get("HYPOTHESIS_PROFILE", "dev"))

CI = os.environ.get("HYPOTHESIS_PROFILE") == "ci"


def examples(full: int, dev: int = 200) -> int:
    """Per-test example count: `full` in CI, `dev` locally."""
    return full if CI else dev
