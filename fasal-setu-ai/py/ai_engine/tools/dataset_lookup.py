
import os
import json
from typing import Dict, Any

DATA_DIR = os.path.join(os.path.dirname(__file__), '../../..', 'data', 'static_json', 'crop_calendar')

def calendar_lookup(args: Dict[str, Any]) -> Dict[str, Any]:
	"""
	Args should include at least: state, district, crop
	"""
	state = args.get('state')
	district = args.get('district')
	crop = args.get('crop')
	if not (state and district and crop):
		return {"data": None, "source_stamp": "missing required args: state, district, crop"}

	# Normalize file name: e.g. karnataka_mysore.json
	file_name = f"{state.lower().replace(' ', '_')}_{district.lower().replace(' ', '_')}.json"
	file_path = os.path.join(DATA_DIR, file_name)
	if not os.path.exists(file_path):
		return {"data": None, "source_stamp": f"not found: {file_name}"}

	with open(file_path, encoding='utf-8') as f:
		data = json.load(f)

	# Find crop entry (case-insensitive match)
	crop_entries = [entry for entry in data.get('crops', []) if entry.get('crop_name', '').lower() == crop.lower()]
	if not crop_entries:
		return {"data": None, "source_stamp": f"crop not found in {file_name}"}

	# Return the first matching crop entry and file as source
	return {"data": crop_entries[0], "source_stamp": file_name}
