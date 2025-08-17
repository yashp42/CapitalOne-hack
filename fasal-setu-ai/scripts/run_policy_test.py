import json
import sys
import os
# Ensure repo root is on path
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
from py.ai_engine.tools import policy_match

args = {'state':'Maharashtra','category':'scheme','keywords':'farmer'}
try:
    r = policy_match.policy_match(args)
    print(json.dumps(r, indent=2, ensure_ascii=False))
except Exception as e:
    print('ERROR', e)
