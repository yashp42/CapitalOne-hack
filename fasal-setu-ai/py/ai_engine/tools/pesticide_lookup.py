
"""Pesticide lookup tool.

This module reads pesticide recommendations from local JSON files. A
production version should query an external pesticide information API
endpoint.

TODO:
    * Integrate with the real pesticide data service.
    * Expand filtering and validation logic.
"""

import json
import os
from typing import Any, Dict

DATA_DIR = os.path.join(os.path.dirname(__file__), '../../..', 'data', 'static_json', 'pesticides')


def pesticide_lookup(args: Dict[str, Any]) -> Dict[str, Any]:
    """Return pesticide advice for a crop.

    Args should include at least ``crop`` and optionally ``target``
    (e.g. pest or disease).

    TODO: Replace file-based lookup with external API call.
    """
    crop = args.get('crop')
    target = args.get('target')
    if not crop:
        return {"data": None, "source_stamp": "missing required arg: crop"}

    # Try to find a file for the crop (e.g. wheat.json), else scan all files
    crop_file = f"{crop.lower().replace(' ', '_')}.json"
    crop_path = os.path.join(DATA_DIR, crop_file)
    entries = []
    if os.path.exists(crop_path):
        with open(crop_path, encoding='utf-8') as f:
            entries = json.load(f)
    else:
        # Scan all files for matching crop
        for fname in os.listdir(DATA_DIR):
            if fname.endswith('.json'):
                with open(os.path.join(DATA_DIR, fname), encoding='utf-8') as f:
                    data = json.load(f)
                    for entry in data:
                        if entry.get('crop_name', '').lower() == crop.lower():
                            entries.append(entry)

    # Optionally filter by target
    if target:
        entries = [e for e in entries if e.get('target', '').lower() == target.lower()]

    if not entries:
        return {"data": None, "source_stamp": f"no pesticide found for crop={crop}"}

    # Return the first matching entry and file as source
    return {"data": entries[0], "source_stamp": crop_file if os.path.exists(crop_path) else 'scanned_all'}
