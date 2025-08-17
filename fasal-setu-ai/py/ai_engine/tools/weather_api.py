
"""
weather_api.py
-------------
Weather lookup tool for Fasal-Setu AI using Open-Meteo API.

Tool Interface:
    weather_lookup(args: dict) -> dict

Arguments:
    args: Dict with:
        - lat, lon (float): Location coordinates 
        - start_date (str, optional): YYYY-MM-DD
        - end_date (str, optional): YYYY-MM-DD  
        - days (int, optional): Forecast days (default=3)

Returns:
    Dict with:
        data: {
            lat, lon (float): Location
            elevation (float|null): Meters above sea level
            tz (str|null): IANA timezone
            run_at (str): ISO UTC timestamp
            time (List[str]): YYYY-MM-DD dates
            tmin_c, tmax_c (List[float]): Daily min/max temps
            rain_mm (List[float]): Daily rainfall
            et0_mm (List[float]): Daily ET₀
            time_hourly (List[str]): ISO timestamps
            temp_2m_c (List[float]): Hourly temperature 
            precip_mm (List[float]): Hourly precipitation
            et0_hourly_mm (List[float]): Hourly ET₀
            wind_speed_hourly_10m_ms (List[float]): Hourly wind
            rh_2m_pct (List[float]): Hourly relative humidity
        }
        source_stamp: {
            provider (str): "open-meteo"
            url (str): API URL used
            window (dict): {start_date, end_date}
            issued_utc (str): ISO timestamp
        }
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
    """Lookup weather forecast for given location and dates"""
    if not isinstance(args, dict):
        return {
            "error": "args must be a dict",
            "source_stamp": {"type": "error", "provider": "weather"}
        }

    # Validate required location
    if "lat" not in args or "lon" not in args:
        return {
            "error": "Missing required keys: 'lat' and 'lon'",
            "source_stamp": {"type": "error", "provider": "weather"}
        }
    try:
        lat, lon = _validate_lat_lon(args["lat"], args["lon"])
    except Exception as e:
        return {
            "error": str(e),
            "source_stamp": {"type": "error", "provider": "weather"}
        }

    # Determine date range
    today = datetime.utcnow().date()
    start = _parse_date(args.get("start_date"))
    end = _parse_date(args.get("end_date"))
    days = min(30, int(args.get("days", 3)))  # Limit to 30 days
    
    if start and end and end < start:
        return {
            "error": "end_date cannot be before start_date",
            "source_stamp": {"type": "error", "provider": "weather"}
        }
        
    if start is None:
        start = today
    if end is None:
        end = start + timedelta(days=days)
        
    # Enforce 30 day limit
    if (end - start).days > 30:
        end = start + timedelta(days=30)

    # Query variables needed
    daily_vars = [
        "temperature_2m_max","temperature_2m_min","precipitation_sum",
        "et0_fao_evapotranspiration","shortwave_radiation_sum","wind_speed_10m_max"
    ]
    hourly_vars = [
        "temperature_2m","precipitation","et0_fao_evapotranspiration",
        "wind_speed_10m","relative_humidity_2m","shortwave_radiation"
    ]
    
    # Build API request
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
    
    # Call API
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {
            "error": f"Weather API error: {e}",
            "source_stamp": {
                "type": "error",
                "provider": "weather",
                "timestamp": _iso_now_utc()
            }
        }

    # Extract data 
    daily = raw.get("daily", {})
    hourly = raw.get("hourly", {})
    
    # Build standardized response
    source_stamp = {
        "provider": "open-meteo",
        "url": url,
        "window": {
            "start_date": start.isoformat(),
            "end_date": end.isoformat()
        },
        "issued_utc": _iso_now_utc()
    }
    
    data = {
        # Location metadata
        "lat": raw.get("latitude", lat),
        "lon": raw.get("longitude", lon),
        "elevation": raw.get("elevation"),
        "tz": raw.get("timezone"),
        "run_at": _iso_now_utc(),
        
        # Daily data
        "time": daily.get("time", []),
        "tmax_c": daily.get("temperature_2m_max", []),
        "tmin_c": daily.get("temperature_2m_min", []),
        "rain_mm": daily.get("precipitation_sum", []),
        "et0_mm": daily.get("et0_fao_evapotranspiration", []),
        
        # Hourly data
        "time_hourly": hourly.get("time", []),
        "temp_2m_c": hourly.get("temperature_2m", []),
        "precip_mm": hourly.get("precipitation", []),
        "et0_hourly_mm": hourly.get("et0_fao_evapotranspiration", []),
        "wind_speed_hourly_10m_ms": hourly.get("wind_speed_10m", []),
        "rh_2m_pct": hourly.get("relative_humidity_2m", [])
    }
    
    return {
        "data": data,
        "source_stamp": source_stamp
    }
