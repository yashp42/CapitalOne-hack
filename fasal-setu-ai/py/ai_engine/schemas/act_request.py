from typing import Any, Dict, Optional

from pydantic import BaseModel


class ActRequest(BaseModel):
    query: Optional[str] = None
    profile: Optional[Dict[str, Any]] = None
