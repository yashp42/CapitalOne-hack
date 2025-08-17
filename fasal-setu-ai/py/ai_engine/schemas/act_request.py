from typing import Any, Dict, List, Literal, Union

from pydantic import BaseModel

try:
    from ..graph.state import Message
except ImportError:
    from graph.state import Message


class ActRequest(BaseModel):
    query: Union[List[Message], List[Dict[str, str]], List[str], str, None] = None  # Support multiple formats for chat history
    profile: Dict[str, Any] | None = None
    mode: Literal["public_advisor", "my_farm"] | None = None
