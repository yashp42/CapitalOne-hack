from rules import temperature_risk

weather = {
  "provider": "open-meteo",
  "source": "open-meteo",
  "source_type": "external",
  "forecast": [
    {"date": "2025-08-20", "tmin": 0, "tmax": 15},
    {"date": "2025-08-21", "tmin": 5, "tmax": 18}
  ]
}
calendar = {"current_stage": "flowering", "stage_critical_temps": {"flowering": {"frost_threshold": 2, "heat_threshold": 38}}}
res = temperature_risk.handle(intent={"lookahead_days": 7}, facts={"weather_outlook": weather, "calendar_lookup": calendar})
print(res)
