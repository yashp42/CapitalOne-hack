"""
Soil API lookup tool (SoilGrids + Open-Meteo).

- provider="soilgrids" (default): returns static soil properties at
  standard depths using ISRIC SoilGrids v2.0.
- provider="openmeteo": returns soil moisture/temperature time series.

Args (all optional unless noted):
{
  "lat": <float>,               # required (tools_node will inject via geocode)
  "lon": <float>,               # required
  "provider": "soilgrids" | "openmeteo",

  # SoilGrids-only:
  "properties": ["phh2o","clay","sand","silt","soc","cec","bdod"],  # default
  "depths": ["0-5cm","5-15cm","15-30cm","30-60cm","60-100cm","100-200cm"],

  # Open-Meteo-only:
  "variables": ["soil_moisture_0_to_10cm","soil_moisture_0_to_100cm","soil_temperature_0cm"],
  "start_date": "YYYY-MM-DD",   # optional; if omitted, next 7 days forecast
  "end_date": "YYYY-MM-DD",
  "hourly": true                # for open-meteo: hourly vs daily aggregation
}

Return envelope (stable):
{
  "data": {...},
  "source_stamp": {...},
  "error": "..."   # only when something failed
}
"""

from __future__ import annotations

import os
import math
import json
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timedelta

try:
    import requests
except Exception:
    requests = None

# ---------- utils ----------

def _canon_num(x: Any) -> Optional[float]:
    try:
        f = float(x)
        if math.isnan(f):
            return None
        return f
    except Exception:
        return None

def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def _default_soilgrids_properties() -> List[str]:
    # Common property codes in SoilGrids v2
    return ["phh2o", "clay", "sand", "silt", "soc", "cec", "bdod"]

def _default_soilgrids_depths() -> List[str]:
    # GlobalSoilMap standard depths
    return ["0-5cm", "5-15cm", "15-30cm", "30-60cm", "60-100cm", "100-200cm"]

def _default_openmeteo_vars() -> List[str]:
    return ["soil_moisture_0_to_10cm", "soil_moisture_0_to_100cm", "soil_temperature_0cm"]

def _iso_date(d: datetime) -> str:
    return d.date().isoformat()

# ---------- providers ----------

def _fetch_soilgrids(lat: float, lon: float,
                     properties: List[str],
                     depths: List[str],
                     timeout: float = 6.0) -> Dict[str, Any]:
    """
    Calls SoilGrids v2.0 properties/query for point estimates.
    Returns a compact dict: { "properties": {prop: {depth: {"p50": val, "unit": unit}} }, "raw_headers": {...} }
    """
    if requests is None:
        return {"data": {}, "error": "requests_not_available"}

    base = "https://rest.isric.org/soilgrids/v2.0/properties/query"
    params: List[Tuple[str, str]] = [
        ("lon", str(lon)), ("lat", str(lat))
    ]
    for p in properties:
        params.append(("property", p))
    for d in depths:
        params.append(("depth", d))

    url = base
    try:
        r = requests.get(url, params=params, timeout=timeout)
        if r.status_code != 200:
            return {"data": {}, "error": f"soilgrids_http_{r.status_code}", "url": r.url}
        j = r.json()
    except Exception as e:
        return {"data": {}, "error": f"soilgrids_error:{e.__class__.__name__}"}

    # Parse SoilGrids response
    out: Dict[str, Any] = {"properties": {}}
    try:
        layers = (j.get("properties") or {}).get("layers") or []
        for layer in layers:
            prop = layer.get("name")
            unit = (layer.get("unit_measure") or {}).get("units")
            # values at depths live in "depths" list
            pmap: Dict[str, Any] = {}
            for dep in (layer.get("depths") or []):
                depth_name = dep.get("label") or dep.get("depth") or dep.get("name")
                stats = dep.get("values") or {}
                # median often "P50" or "Q50"; also "mean" may exist — prefer median if present
                p50 = stats.get("P50") or stats.get("Q50") or stats.get("median") or stats.get("mean")
                val = _canon_num(p50)
                if val is not None:
                    pmap[depth_name] = {"p50": val, "unit": unit}
            if prop and pmap:
                out["properties"][prop] = pmap
        out["_meta"] = {"provider": "soilgrids", "fetched_at": _now_iso()}
        return {"data": out, "url": r.url}
    except Exception as e:
        return {"data": {}, "error": f"soilgrids_parse_error:{e.__class__.__name__}"}


def _fetch_openmeteo(lat: float, lon: float,
                     variables: List[str],
                     start_date: Optional[str],
                     end_date: Optional[str],
                     hourly: bool = True,
                     timeout: float = 6.0) -> Dict[str, Any]:
    """
    Calls Open-Meteo forecast API for soil variables.
    Returns timeseries under "hourly" or "daily".
    """
    if requests is None:
        return {"data": {}, "error": "requests_not_available"}

    base = "https://api.open-meteo.com/v1/forecast"
    params: Dict[str, Any] = {
        "latitude": lat,
        "longitude": lon,
        "timezone": "auto"
    }
    key = "hourly" if hourly else "daily"
    params[key] = ",".join(variables or _default_openmeteo_vars())

    # If user didn’t provide dates, default to next 7 days; Open-Meteo also supports historical via another API.
    if start_date and end_date:
        params["start_date"] = start_date
        params["end_date"] = end_date

    try:
        r = requests.get(base, params=params, timeout=timeout)
        if r.status_code != 200:
            return {"data": {}, "error": f"openmeteo_http_{r.status_code}", "url": r.url}
        j = r.json()
    except Exception as e:
        return {"data": {}, "error": f"openmeteo_error:{e.__class__.__name__}"}

    # Extract only requested block and variables
    block = j.get(key) or {}
    # Keep only the requested vars + time
    keep_vars = ["time"] + variables
    filtered = {k: v for k, v in block.items() if k in keep_vars}

    out = {
        "location": {"lat": lat, "lon": lon},
        "variables": variables,
        key: filtered
    }
    out["_meta"] = {"provider": "openmeteo", "fetched_at": _now_iso()}
    return {"data": out, "url": r.url}

# ---------- public tool ----------

def soil_api(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Dispatch between SoilGrids (static properties) and Open-Meteo (soil moisture/temperature).
    """
    lat = args.get("lat")
    lon = args.get("lon")
    if lat is None or lon is None:
        return {"data": {}, "source_stamp": {"type": "soil", "provider": None}, "error": "missing_lat_lon"}

    provider = (args.get("provider") or "soilgrids").lower()

    if provider == "openmeteo":
        variables = args.get("variables") or _default_openmeteo_vars()
        start_date = args.get("start_date")
        end_date = args.get("end_date")
        hourly = bool(args.get("hourly", True))
        res = _fetch_openmeteo(float(lat), float(lon), variables, start_date, end_date, hourly)
        url = res.get("url")
        data = res.get("data", {})
        err = res.get("error")
        stamp = {
            "type": "soil",
            "provider": "openmeteo",
            "executed_at": _now_iso(),
            "url": url,
            "args_used": {"variables": variables, "hourly": hourly, "start_date": start_date, "end_date": end_date}
        }
        out = {"data": data, "source_stamp": stamp}
        if err:
            out["error"] = err
        return out

    # default: soilgrids
    properties = args.get("properties") or _default_soilgrids_properties()
    depths = args.get("depths") or _default_soilgrids_depths()
    res = _fetch_soilgrids(float(lat), float(lon), properties, depths)
    url = res.get("url")
    data = res.get("data", {})
    err = res.get("error")
    stamp = {
        "type": "soil",
        "provider": "soilgrids",
        "executed_at": _now_iso(),
        "url": url,
        "args_used": {"properties": properties, "depths": depths}
    }
    out = {"data": data, "source_stamp": stamp}
    if err:
        out["error"] = err
    return out
