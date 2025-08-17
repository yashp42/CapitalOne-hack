# models.py
"""
Pydantic models for Decision Engine — aligned to the JSON schemas supplied in datasets.zip.

This file defines:
 - strict tool output models based on your provided schema files:
    crop_calendar.schema.json, weather.schema.json, soil.schema.json,
    pesticides.schema.json, mandi_prices.schema.json, dataset_sources.schema.json
 - ToolCall model which validates/parses tool outputs to the corresponding model
 - ActIntentModel (input)
 - DecisionResponseModel (canonical output envelope)
"""

from __future__ import annotations
from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field, root_validator, ValidationError
from datetime import datetime

decision_timestamp: datetime = Field(default_factory=datetime.now)


# ---------------------------
# crop_calendar schema model
# ---------------------------

class PlantingWindow(BaseModel):
    start: Optional[str] = None
    end: Optional[str] = None

class ContingencyItem(BaseModel):
    alt_crops: Optional[Any] = None
    hazard: Optional[str] = None
    inputs_support_notes: Optional[str] = None
    measures: Optional[List[Any]] = Field(default_factory=list)
    stage_window: Optional[Any] = None

class IrrigationIdeal(BaseModel):
    critical_stages: Optional[List[Any]] = Field(default_factory=list)
    notes: Optional[str] = None
    seasonal_requirement_mm: Optional[float] = None

class SoilIdeal(BaseModel):
    ph_range: Optional[Any] = None
    text: Optional[str] = None

class MarketMapping(BaseModel):
    commodity_names: Optional[List[str]] = Field(default_factory=list)

class CropEntry(BaseModel):
    crop_name: Optional[str] = None
    season: Optional[str] = None
    planting_window: Optional[PlantingWindow] = None
    stages: Optional[List[Any]] = Field(default_factory=list)
    stage_lengths_days: Optional[Any] = None
    irrigation_ideal: Optional[IrrigationIdeal] = None
    soil_ideal: Optional[SoilIdeal] = None
    weather_ideal: Optional[Dict[str, Any]] = Field(default_factory=dict)
    contingencies: Optional[List[ContingencyItem]] = Field(default_factory=list)
    market_mapping: Optional[MarketMapping] = None
    data_gaps: Optional[List[str]] = Field(default_factory=list)
    sources: Optional[List[str]] = Field(default_factory=list)
    # allow extra fields inside a crop entry (defensive)
    class Config:
        extra = "allow"

class DatasetSourceItem(BaseModel):
    key: Optional[str] = None
    title: Optional[str] = None
    url: Optional[str] = None
    tier: Optional[str] = None
    last_checked: Optional[str] = None

class CropCalendarOutput(BaseModel):
    state: Optional[str] = None
    district: Optional[str] = None
    agro_climatic_zone: Optional[str] = None
    source_type: Optional[str] = None
    source_url: Optional[str] = None
    doc_date: Optional[str] = None
    last_checked: Optional[str] = None
    normal_annual_rain_mm: Optional[float] = None
    rainfall_pattern_notes: Optional[str] = None
    dominant_soils: Optional[List[str]] = Field(default_factory=list)
    crops: Optional[List[CropEntry]] = Field(default_factory=list)
    dataset_sources: Optional[List[DatasetSourceItem]] = Field(default_factory=list)
    source_id: Optional[str] = None
    source_type: Optional[str] = None


# ---------------------------
# weather schema model
# ---------------------------

class WeatherHourlyArrays(BaseModel):
    time_hourly: Optional[List[Any]] = Field(default_factory=list)
    temp_2m_c: Optional[List[Any]] = Field(default_factory=list)
    precip_mm: Optional[List[Any]] = Field(default_factory=list)
    et0_hourly_mm: Optional[List[Any]] = Field(default_factory=list)
    wind_speed_hourly_10m_ms: Optional[List[Any]] = Field(default_factory=list)
    rh_2m_pct: Optional[List[Any]] = Field(default_factory=list)

class WeatherOutput(BaseModel):
    lat: Optional[float] = None
    lon: Optional[float] = None
    elevation: Optional[float] = None
    tz: Optional[str] = None
    run_at: Optional[str] = None
    time: Optional[List[Any]] = Field(default_factory=list)          # usually list[str]
    tmin_c: Optional[List[Any]] = Field(default_factory=list)        # usually list[float]
    tmax_c: Optional[List[Any]] = Field(default_factory=list)
    rain_mm: Optional[List[Any]] = Field(default_factory=list)
    et0_mm: Optional[List[Any]] = Field(default_factory=list)
    wind_speed_10m_ms: Optional[float] = None
    rh_mean_pct: Optional[float] = None
    shortwave_radiation_mj_m2: Optional[float] = None
    # hourly arrays (kept as a separate nested model for clarity)
    time_hourly: Optional[List[Any]] = Field(default_factory=list)
    temp_2m_c: Optional[List[Any]] = Field(default_factory=list)
    precip_mm: Optional[List[Any]] = Field(default_factory=list)
    et0_hourly_mm: Optional[List[Any]] = Field(default_factory=list)
    wind_speed_hourly_10m_ms: Optional[List[Any]] = Field(default_factory=list)
    rh_2m_pct: Optional[List[Any]] = Field(default_factory=list)
    source_id: Optional[str] = None
    source_type: Optional[str] = None



# ---------------------------
# soil schema model
# ---------------------------

class OCDistributionPct(BaseModel):
    low: Optional[float] = None
    medium: Optional[float] = None
    high: Optional[float] = None

class SoilSampleOutput(BaseModel):
    state: Optional[str] = None
    district: Optional[str] = None
    block: Optional[str] = None
    village: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    sample_id: Optional[str] = None
    collection_date: Optional[str] = None
    ph: Optional[float] = None
    ec_ds_m: Optional[float] = None
    oc_percent: Optional[float] = None
    available_n_kg_ha: Optional[float] = None
    available_p_kg_ha: Optional[float] = None
    available_k_kg_ha: Optional[float] = None
    sulphur_ppm: Optional[float] = None
    zinc_ppm: Optional[float] = None
    iron_ppm: Optional[float] = None
    copper_ppm: Optional[float] = None
    manganese_ppm: Optional[float] = None
    bo_ppm: Optional[float] = None
    b_ppm: Optional[float] = None
    n_class: Optional[str] = None
    p_class: Optional[str] = None
    k_class: Optional[str] = None
    oc_class: Optional[str] = None
    lab_name: Optional[str] = None
    recommendation_notes: Optional[str] = None
    oc_distribution_pct: Optional[OCDistributionPct] = None
    n_class_pct: Optional[OCDistributionPct] = None
    p_class_pct: Optional[OCDistributionPct] = None
    k_class_pct: Optional[OCDistributionPct] = None
    ph_summary: Optional[str] = None
    last_checked: Optional[str] = None
    source_id: Optional[str] = None
    source_type: Optional[str] = None
    # accept extra fields present in the schema
    class Config:
        extra = "allow"


# ---------------------------
# pesticides schema model
# ---------------------------

class PesticideOutput(BaseModel):
    crop_name: Optional[str] = None
    target: Optional[str] = None
    active_ingredient: Optional[str] = None
    formulation: Optional[str] = None
    dose_ai_g_ha: Optional[float] = None
    dose_formulation_qty_per_ha: Optional[float] = None
    spray_volume_l_ha: Optional[float] = None
    application_method: Optional[str] = None
    phi_days: Optional[int] = None
    ppe_notes: Optional[str] = None
    who_class: Optional[str] = None
    label_source_url: Optional[str] = None
    as_on_date: Optional[str] = None
    last_checked: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    sources: Optional[List[str]] = Field(default_factory=list)
    source_id: Optional[str] = None
    source_type: Optional[str] = None


# ---------------------------
# mandi prices schema model
# ---------------------------

class MandiPriceOutput(BaseModel):
    state: Optional[str] = None
    district: Optional[str] = None
    market: Optional[str] = None
    arrival_date: Optional[str] = None
    commodity: Optional[str] = None
    variety: Optional[str] = None
    min_price_rs_per_qtl: Optional[float] = None
    max_price_rs_per_qtl: Optional[float] = None
    modal_price_rs_per_qtl: Optional[float] = None
    arrival_qty: Optional[float] = None
    source_url: Optional[str] = None
    source_id: Optional[str] = None
    source_type: Optional[str] = None
    last_checked: Optional[str] = None


# ---------------------------
# dataset_sources schema model (simple)
# ---------------------------

class DatasetSourceOutput(BaseModel):
    # The file provided is effectively an array of {key, title, url, tier, last_checked}
    key: Optional[str] = None
    title: Optional[str] = None
    url: Optional[str] = None
    tier: Optional[str] = None
    last_checked: Optional[str] = None
    source_id: Optional[str] = None
    source_type: Optional[str] = None


# ---------------------------
# RAG search minimal model (kept permissive)
# ---------------------------

class RagResultItem(BaseModel):
    doc_id: str
    text: Optional[str] = None
    relevance: Optional[float] = None
    meta: Optional[Dict[str, Any]] = None
    source_id: Optional[str] = None
    source_type: Optional[str] = None

class RagSearchOutput(BaseModel):
    results: Optional[List[RagResultItem]] = Field(default_factory=list)
    source: Optional[str] = None
    source_id: Optional[str] = None
    source_type: Optional[str] = None


# ---------------------------
# ToolCall model and mapping to strict models
# ---------------------------

ToolNameLiteral = Literal[
    "weather_outlook",
    "prices_fetch",
    "calendar_lookup",
    "variety_lookup",
    "policy_match",
    "pesticide_lookup",
    "storage_find",
    "rag_search",
    # map the schema-provided names
    "crop_calendar",
    "soil_profile",
    "mandi_prices"
]

class ToolCall(BaseModel):
    tool: ToolNameLiteral
    args: Optional[Dict[str, Any]] = Field(default_factory=dict)
    output: Optional[Any] = None

    @root_validator(pre=True)
    def validate_and_parse_output(cls, values):
        tool = values.get("tool")
        out = values.get("output", {}) or {}

        mapping = {
            "weather_outlook": WeatherOutput,
            "prices_fetch": MandiPriceOutput,   # legacy mapping: prices_fetch -> mandi_prices format
            "calendar_lookup": CropCalendarOutput,
            "variety_lookup": RagSearchOutput,  # variety lookup may be provided as rag_search-like results
            "policy_match": DatasetSourceOutput,
            "pesticide_lookup": PesticideOutput,
            "storage_find": DatasetSourceOutput,
            "rag_search": RagSearchOutput,
            # explicit schema names in your zip
            "crop_calendar": CropCalendarOutput,
            "soil_profile": SoilSampleOutput,
            "mandi_prices": MandiPriceOutput
        }

        model_cls = mapping.get(tool)
        if model_cls is None:
            # Unknown mapping: leave output as-is but keep the field
            values["output"] = out
            return values

        # parse using the mapped strict model
        try:
            if isinstance(out, model_cls):
                values["output"] = out
            else:
                parsed = model_cls.parse_obj(out)
                values["output"] = parsed
        except ValidationError as e:
            # Raise ValueError so the orchestrator can catch and return invalid_input
            raise ValueError(f"Tool '{tool}' output failed schema validation: {e}") from e

        return values


# ---------------------------
# Top-level ActIntent model (input)
# ---------------------------

class ActIntentModel(BaseModel):
    intent: str
    decision_template: str
    tool_calls: List[ToolCall]
    missing: Optional[List[str]] = Field(default_factory=list)
    facts: Optional[Dict[str, Any]] = Field(default_factory=dict)
    request_id: Optional[str] = None

    class Config:
        extra = "allow"


# ---------------------------
# Decision response (canonical output)
# ---------------------------

class EvidenceItem(BaseModel):
    type: str
    value: Any
    source: Optional[str] = None

class AuditStep(BaseModel):
    step: str
    details: Optional[str] = None

class DecisionItem(BaseModel):
    name: str
    score: Optional[float] = None
    reasons: Optional[List[str]] = None
    tradeoffs: Optional[List[str]] = None
    meta: Optional[Dict[str, Any]] = None
    sources: Optional[List[Dict[str,Any]]] = None

class DecisionResult(BaseModel):
    action: str
    items: List[DecisionItem] = Field(default_factory=list)
    confidence: Optional[float] = None
    notes: Optional[str] = None

class DecisionResponseModel(BaseModel):
    request_id: Optional[str] = None
    intent: str
    decision_template: str
    decision_timestamp: datetime
    status: Literal["complete", "incomplete", "invalid_input", "handler_not_found"] = "complete"
    result: Optional[DecisionResult] = None
    evidence: Optional[List[EvidenceItem]] = Field(default_factory=list)
    provenance: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    audit_trace: Optional[List[AuditStep]] = Field(default_factory=list)
    confidence: Optional[float] = None
    missing: Optional[List[str]] = Field(default_factory=list)
    source_id: Optional[str] = None
    source_type: Optional[str] = None

# Export names
__all__ = [
    "ActIntentModel",
    "ToolCall",
    "WeatherOutput",
    "CropCalendarOutput",
    "SoilSampleOutput",
    "PesticideOutput",
    "MandiPriceOutput",
    "RagSearchOutput",
    "DecisionResponseModel",
    "DecisionResult",
    "DecisionItem",
    "EvidenceItem",
    "AuditStep",
]
