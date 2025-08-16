
"""
weather_api.py
--------------
Simple weather lookup too    try:
        today = datetime.utcnow().date()
        start = _parse_date(args.get("start_date"))
        end = _parse_date(args.get("end_date"))
        days = max(1, min(30, int(args.get("days", 3))))  # Limit to 1-30 days
        
        if start and end and end < start:
            return {"error": "end_date must be after start_date", "source_stamp": {"type": "error", "provider": "weather"}}
            
        if start is None and end is None:
            start = today
            end = today + timedelta(days=days)
        elif start is None and end is not None:
            start = end - timedelta(days=days)
        elif start is not None and end is None:
            end = start + timedelta(days=days)
            
        # Ensure the date range isn't too long
        if (end - start).days > 30:
            end = start + timedelta(days=30)
            
        return_dates = {"start_date": start.isoformat(), "end_date": end.isoformat()}
    except Exception as e:
        return {"error": f"Date parsing error: {str(e)}", "source_stamp": {"type": "error", "provider": "weather"}}etu AI using Open-Meteo API.

Exposes weather_lookup(args: dict) as the main callable for LLM and server use.
Args must include lat, lon (float); optionally start_date, end_date, or days.
Returns a dict with daily/hourly weather data and Open-Meteo source info.
"""

import json
from datetime import datetime, timedelta, date, timezone
from typing import Any, Dict, Optional
from urllib.parse import urlencode
import urllib.request

OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast"

def _iso_now_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

def _validate_lat_lon(lat: Any, lon: Any) -> tuple[float, float]:
    lat = float(lat)
    lon = float(lon)
    if not (-90 <= lat <= 90):
        raise ValueError("lat must be between -90 and 90")
    if not (-180 <= lon <= 180):
        raise ValueError("lon must be between -180 and 180")
    return lat, lon

def _parse_date(s: Optional[str]) -> Optional[date]:
    return datetime.strptime(s, "%Y-%m-%d").date() if s else None

def weather_lookup(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main weather tool for LLM/server. Args: dict with lat, lon, optional start_date, end_date, days.
    Returns: dict with daily/hourly weather data and Open-Meteo source info.

    Schema:
    {
        "lat": float,
        "lon": float,
        "elevation": float|null,
        "tz": string|null,
        "run_at": "YYYY-MM-DDTHH:MM:SSZ",
        "time": ["YYYY-MM-DD", ...],
        "tmin_c": [float|null, ...],
        "tmax_c": [float|null, ...],
        "rain_mm": [float|null, ...],
        "et0_mm": [float|null, ...],
        "source": {"provider", "url", "window", "issued_utc"}
    }
    """
    if not isinstance(args, dict):
        return {"error": "args must be a dict", "source_stamp": {"type": "error", "provider": "weather"}}
    if "lat" not in args or "lon" not in args:
        return {"error": "Missing required keys: 'lat' and 'lon'", "source_stamp": {"type": "error", "provider": "weather"}}
    try:
        lat, lon = _validate_lat_lon(args["lat"], args["lon"])
    except Exception as e:
        return {"error": str(e), "source_stamp": {"type": "error", "provider": "weather"}}

    # Robust date handling
    start = _parse_date(args.get("start_date"))
    end = _parse_date(args.get("end_date"))
    days = int(args.get("days", 3))
    today = datetime.utcnow().date()
    if start and end and end < start:
        return {"error": "end_date cannot be before start_date"}
    if start is None and end is None:
        start = today
        end = start + timedelta(days=days)
    elif start is None and end is not None:
        start = end - timedelta(days=days)
    elif start is not None and end is None:
        end = start + timedelta(days=days)

    daily_vars = [
        "temperature_2m_max","temperature_2m_min","precipitation_sum",
        "et0_fao_evapotranspiration","shortwave_radiation_sum","wind_speed_10m_max"
    ]
    hourly_vars = [
        "temperature_2m","precipitation","et0_fao_evapotranspiration",
        "wind_speed_10m","relative_humidity_2m","shortwave_radiation"
    ]
    params = {
        "latitude": lat,
        "longitude": lon,
        "timezone": "auto",
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "daily": ",".join(daily_vars),
        "hourly": ",".join(hourly_vars),
    }
    url = OPEN_METEO_BASE + "?" + urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"error": f"Weather API error: {e}"}

    daily = raw.get("daily", {})
    hourly = raw.get("hourly", {})
    result = {
        "lat": raw.get("latitude", lat),
        "lon": raw.get("longitude", lon),
        "elevation": raw.get("elevation"),
        "tz": raw.get("timezone"),
        "run_at": _iso_now_utc(),
        "time": daily.get("time", []),
        "tmax_c": daily.get("temperature_2m_max", []),
        "tmin_c": daily.get("temperature_2m_min", []),
        "rain_mm": daily.get("precipitation_sum", []),
        "et0_mm": daily.get("et0_fao_evapotranspiration", []),
        "time_hourly": hourly.get("time", []),
        "temp_2m_c": hourly.get("temperature_2m", []),
        "precip_mm": hourly.get("precipitation", []),
        "et0_hourly_mm": hourly.get("et0_fao_evapotranspiration", []),
        "wind_speed_hourly_10m_ms": hourly.get("wind_speed_10m", []),
        "rh_2m_pct": hourly.get("relative_humidity_2m", []),
        "source": {
            "provider": "open-meteo",
            "url": url,
            "window": {"start_date": start.isoformat(), "end_date": end.isoformat()},
            "issued_utc": _iso_now_utc(),
        }
    }
    return result
