import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
try:
    import py.ai_engine.tools.policy_match as pm
    print('import_ok', flush=True)
except Exception as e:
    import traceback
    traceback.print_exc()
    print('IMPORT_ERROR', e, flush=True)
