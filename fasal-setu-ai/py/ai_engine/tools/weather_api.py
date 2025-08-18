import requests
from typing import Dict, Any

def weather_outlook(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calls Open-Meteo API to fetch weather forecast and returns data in the specified schema.
    Args:
        args: dict with keys 'lat' and 'lon' (required), others optional.
    Returns:
        dict with keys: data (weather schema), source_stamp
    """
    lat = args.get("lat")
    lon = args.get("lon")
    if lat is None or lon is None:
        return {"data": None, "source_stamp": "missing_lat_lon"}

    # Open-Meteo API endpoint and parameters
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,precipitation,et0_fao_evapotranspiration,relative_humidity_2m,wind_speed_10m",
        "daily": "temperature_2m_min,temperature_2m_max,precipitation_sum,et0_fao_evapotranspiration,wind_speed_10m_max,shortwave_radiation_sum",
        "timezone": "auto"
    }

    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        # Map Open-Meteo response to your weather.schema.json
        daily = data.get("daily", {})
        hourly = data.get("hourly", {})
        result = {
            "lat": lat,
            "lon": lon,
            "elevation": data.get("elevation"),
            "tz": data.get("timezone"),
            "run_at": data.get("generationtime_ms"),
            "time": daily.get("time", []),
            "tmin_c": daily.get("temperature_2m_min", []),
            "tmax_c": daily.get("temperature_2m_max", []),
            "rain_mm": daily.get("precipitation_sum", []),
            "et0_mm": daily.get("et0_fao_evapotranspiration", []),
            "wind_speed_10m_ms": daily.get("wind_speed_10m_max"),
            "rh_mean_pct": None,  # Not directly available in daily
            "shortwave_radiation_mj_m2": daily.get("shortwave_radiation_sum"),
            "time_hourly": hourly.get("time", []),
            "temp_2m_c": hourly.get("temperature_2m", []),
            "precip_mm": hourly.get("precipitation", []),
            "et0_hourly_mm": hourly.get("et0_fao_evapotranspiration", []),
            "wind_speed_hourly_10m_ms": hourly.get("wind_speed_10m", []),
            "rh_2m_pct": hourly.get("relative_humidity_2m", []),
        }
        return {
            "data": result,
            "source_stamp": "Open-Meteo https://open-meteo.com/"
        }
    except Exception as e:
        return {"data": None, "source_stamp": f"weather_api_error: {e}"}
