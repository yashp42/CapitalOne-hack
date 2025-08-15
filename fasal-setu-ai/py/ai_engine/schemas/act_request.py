from typing import Any, Dict, Literal

from pydantic import BaseModel


class ActRequest(BaseModel):
    query: str | None = None
    profile: Dict[str, Any] | None = None
    mode: Literal["public_advisor", "my_farm"] | None = None
