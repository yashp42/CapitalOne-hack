"""Centralized path constants for ai_engine data assets.

After moving the data directory inside py/ai_engine, tools should import
these constants instead of climbing parent directories.
"""
from __future__ import annotations

from pathlib import Path

# Base directory of the ai_engine package (py/ai_engine)
BASE_DIR = Path(__file__).resolve().parent.parent

# Data root now located at py/ai_engine/data
DATA_DIR = BASE_DIR / "data"
STATIC_JSON_DIR = DATA_DIR / "static_json"
VECTORS_DIR = DATA_DIR / "vectors"
MODELS_DIR = DATA_DIR / "models"

# Convenience subdirs (create on demand by caller if needed)
GEO_DIR = STATIC_JSON_DIR / "geo"
CROP_CALENDAR_DIR = STATIC_JSON_DIR / "crop_calendar"
PESTICIDES_DIR = STATIC_JSON_DIR / "pesticides"
POLICY_DIR = STATIC_JSON_DIR / "policy"
STORAGE_WDRA_DIR = STATIC_JSON_DIR / "storage" / "wdra"
SOIL_DIR = STATIC_JSON_DIR / "soil"

__all__ = [
    "BASE_DIR",
    "DATA_DIR",
    "STATIC_JSON_DIR",
    "VECTORS_DIR",
    "MODELS_DIR",
    "GEO_DIR",
    "CROP_CALENDAR_DIR",
    "PESTICIDES_DIR",
    "POLICY_DIR",
    "STORAGE_WDRA_DIR",
    "SOIL_DIR",
]
