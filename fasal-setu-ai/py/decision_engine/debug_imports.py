# debug_imports.py
import importlib, sys, traceback

def info(modname):
    try:
        m = importlib.import_module(modname)
        print(f"MODULE {modname} imported: {m}")
        attrs = {}
        for name in ("ActIntentModel", "DecisionResponseModel"):
            attrs[name] = getattr(m, name, None)
        print("  ActIntentModel:", attrs["ActIntentModel"])
        print("  DecisionResponseModel:", attrs["DecisionResponseModel"])
    except Exception:
        print(f"FAILED to import {modname}")
        traceback.print_exc()

info("decision_engine.models")
info("decision_engine.orchestrator")
# inspect orchestrator namespace values if imported
try:
    import decision_engine.orchestrator as o
    print("In orchestrator, ActIntentModel:", getattr(o, "ActIntentModel", None))
except Exception:
    print("Couldn't import orchestrator (see above)")
