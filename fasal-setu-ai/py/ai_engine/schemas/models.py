from typing import Dict, List, Optional, Any, Union
from enum import Enum
from pydantic import BaseModel, Field


class ServiceMode(str, Enum):
    PUBLIC = "public"  # Stateless public advisor mode
    MY_FARM = "my_farm"  # Personalized mode with profile/timeline RAG


class ToolCall(BaseModel):
    """Model for a tool call request from the planner."""
    tool: str = Field(..., description="The name of the tool to call")
    args: Dict[str, Any] = Field(default_factory=dict, description="Arguments to pass to the tool")


class SourceStamp(BaseModel):
    """Source information for facts or RAG results."""
    source: str = Field(..., description="Source identifier or name")
    timestamp: Optional[str] = Field(None, description="Timestamp of the source data")
    url: Optional[str] = Field(None, description="URL of the source if applicable")


class RagResult(BaseModel):
    """Result from a RAG search."""
    text: str = Field(..., description="The relevant text passage")
    source_stamp: SourceStamp = Field(..., description="Source information for this passage")


class WeatherData(BaseModel):
    """Weather data structure."""
    daily: Optional[Dict[str, Any]] = Field(None, description="Daily weather forecast")
    hourly: Optional[Dict[str, Any]] = Field(None, description="Hourly weather forecast")
    temperature: Optional[Dict[str, float]] = Field(None, description="Temperature data")
    rain: Optional[Dict[str, float]] = Field(None, description="Precipitation data")
    et0: Optional[Dict[str, float]] = Field(None, description="ET₀ (evapotranspiration) data")
    source_stamp: SourceStamp = Field(..., description="Source information for this data")


class PriceData(BaseModel):
    """Mandi price data structure."""
    prices: List[Dict[str, Any]] = Field(..., description="List of price entries")
    arrivals: Optional[Dict[str, Any]] = Field(None, description="Arrival quantities")
    source_stamp: SourceStamp = Field(..., description="Source information for this data")


class CropInfo(BaseModel):
    """Crop information from dataset lookup."""
    calendar: Optional[Dict[str, Any]] = Field(None, description="Crop calendar information")
    varieties: Optional[List[Dict[str, Any]]] = Field(None, description="Crop varieties information")
    source_stamp: SourceStamp = Field(..., description="Source information for this data")


class PolicyInfo(BaseModel):
    """Policy information from dataset lookup."""
    policies: List[Dict[str, Any]] = Field(..., description="List of relevant policies")
    source_stamp: SourceStamp = Field(..., description="Source information for this data")


class PesticideInfo(BaseModel):
    """Pesticide information from dataset lookup."""
    pesticides: List[Dict[str, Any]] = Field(..., description="List of pesticides")
    source_stamp: SourceStamp = Field(..., description="Source information for this data")


class StorageInfo(BaseModel):
    """Storage facility information."""
    facilities: List[Dict[str, Any]] = Field(..., description="List of storage facilities")
    source_stamp: SourceStamp = Field(..., description="Source information for this data")


class SoilInfo(BaseModel):
    """Soil information from dataset lookup or API."""
    data: Dict[str, Any] = Field(..., description="Soil data")
    source_stamp: SourceStamp = Field(..., description="Source information for this data")


class FactsBundle(BaseModel):
    """Aggregated facts from all tool calls."""
    weather: Optional[WeatherData] = Field(None, description="Weather information")
    prices: Optional[PriceData] = Field(None, description="Mandi price information")
    crop_info: Optional[Dict[str, CropInfo]] = Field(None, description="Crop information by crop name")
    policies: Optional[PolicyInfo] = Field(None, description="Policy information")
    pesticides: Optional[PesticideInfo] = Field(None, description="Pesticide information")
    storage: Optional[StorageInfo] = Field(None, description="Storage facility information")
    soil: Optional[SoilInfo] = Field(None, description="Soil information")
    rag: Optional[List[RagResult]] = Field(None, description="RAG search results from general knowledge")
    personal_rag: Optional[List[RagResult]] = Field(None, description="RAG search results from personal history")
    
    # Fields for the Decision Engine
    stage: Optional[str] = Field(None, description="Crop stage (e.g., 'pre_sowing', 'vegetative')")
    das: Optional[int] = Field(None, description="Days After Sowing")
    signals: Optional[Dict[str, Any]] = Field(None, description="Signals extracted from facts")
    citations: Optional[Dict[str, Any]] = Field(None, description="Citations for facts used")


class DecisionTemplate(str, Enum):
    """Predefined decision template types."""
    WEATHER_ADVISORY = "weather_advisory"
    CROP_CALENDAR = "crop_calendar"
    CROP_SELECTION = "crop_selection"
    PEST_DISEASE = "pest_disease"
    FERTILIZER = "fertilizer"
    MARKET_PRICE = "market_price"
    GENERAL_INFO = "general_info"
    POLICY_INFO = "policy_info"
    STORAGE_INFO = "storage_info"
    UNKNOWN = "unknown"


class FarmerProfile(BaseModel):
    """Farmer profile data."""
    id: Optional[str] = Field(None, description="Unique farmer ID")
    name: Optional[str] = Field(None, description="Farmer name")
    location: Optional[Dict[str, Any]] = Field(None, description="Farmer location details")
    crops: Optional[List[Dict[str, Any]]] = Field(None, description="List of crops being grown")
    field_size: Optional[float] = Field(None, description="Field size in acres/hectares")
    timeline: Optional[List[Dict[str, Any]]] = Field(None, description="Farmer activity timeline")
    preferences: Optional[Dict[str, Any]] = Field(None, description="Farmer preferences")


class ActRequest(BaseModel):
    """Input request for the /act endpoint."""
    query: str = Field(..., description="The farmer's query in natural language")
    profile: Optional[FarmerProfile] = Field(None, description="Farmer profile for personalized responses")
    mode: ServiceMode = Field(default=ServiceMode.PUBLIC, description="Service mode (public or my_farm)")


class ActResponse(BaseModel):
    """Response from the /act endpoint."""
    intent: str = Field(..., description="The detected intent of the farmer's query")
    decision_template: DecisionTemplate = Field(..., description="The decision template to use")
    missing: Optional[List[str]] = Field(None, description="List of missing information needed to complete the request")
    tool_calls: List[ToolCall] = Field(default_factory=list, description="List of tool calls to execute")
    facts: FactsBundle = Field(default_factory=FactsBundle, description="Aggregated facts from tool calls")
