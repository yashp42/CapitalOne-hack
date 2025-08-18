from typing import Any, Dict, List, Literal, Union

from pydantic import BaseModel

try:  # package import
    from ..graph.state import Message  # type: ignore
except Exception:  # fallback when run as script
    from graph.state import Message  # type: ignore


class ActRequest(BaseModel):
    query: Union[List[Message], List[Dict[str, str]], List[str], str, None] = None  # Support multiple formats for chat history
    profile: Dict[str, Any] | None = None
    mode: Literal["public_advisor", "my_farm"] | None = None
