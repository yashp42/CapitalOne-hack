"""Crop variety lookup tool.

This is a placeholder module that will eventually query a variety
recommendation service. For now it returns an empty payload.

Endpoint notes:
    Intended to call a future crop variety API.

TODO:
    * Implement call to variety selection endpoint.
    * Decide on the schema for request and response.
"""

from typing import Any, Dict


def variety_lookup(args: Dict[str, Any]) -> Dict[str, Any]:
    """Stub implementation for crop variety lookup."""

    # TODO: Replace with real variety lookup logic
    return {"data": {}, "source_stamp": "variety_lookup_stub"}
