# rules/pesticide_advice.py
"""
Handler for intent: "pesticide_advice"
Decision template: "pesticide_safe_recommendation"

Purpose:
 - Given pesticide catalog outputs and optional pest diagnosis, recommend safe pesticide products
   and highlight safety constraints (pre-harvest interval, toxicity notes, restricted uses).
 - Deterministic rule-based selection: filter products by pest (if known), crop compatibility (if known),
   and PHI (pre-harvest interval) relative to days-to-harvest (if known).

Expected inputs (facts dict keys, provided from tool_calls[*]['output']):
 - pesticide_lookup (REQUIRED) : dict with key "products" (list of product dicts).
    Each product dict ideally contains:
      - name (str)
      - active_ingredient (str)
      - target_pests (list of strings) OR targets (list)
      - crops (list of crop names) OR allowed_crops
      - pre_harvest_interval_days OR phi_days (int/float)
      - safety_notes (str)
      - max_dosage (str/number)
      - source (str) - provider name
      - restricted (bool) optional
      - toxicity_category (str/number) optional
      - retrieved_at / provider / confidence optional
 - rag_search (optional): may contain 'detected_pests' (list of pest names) or 'pest_id' or textual diagnosis
 - calendar_lookup (optional): can include 'days_to_harvest' or 'days_until_harvest' to evaluate PHI
 - intent may include 'crop' or 'crop_name' (preferred) and optional 'pest' name

Return shape:
 {
   "action": "pesticide_safe_recommendation",
   "items": [
     {
       "name": "<product name>",
       "score": <0..1 confidence>,
       "reasons": [...],
       "tradeoffs": [...],
       "meta": {active_ingredient, phi_days, max_dosage, allowed_crops, restricted, toxicity_category},
       "sources": [ provenance entries ],
     },
     ...
   ],
   "confidence": float,
   "notes": "...",
   "missing": [...]  # if required tools missing
 }

Assumptions (explicit):
 - Temps, units, or conversions are not assumed. PHI days are integer/float days.
 - If `detected_pests` present, we match target_pests using case-insensitive substring matching.
 - If `crop` info not available, we will not filter by crop unless product has an explicit crops list and user provided crop.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import logging
import statistics

# Robust imports for helpers and provenance (relative first)
try:
    from ..utils import helpers as helpers
    from ..utils import provenance as provenance
except Exception:
    try:
        from utils import helpers as helpers
        from utils import provenance as provenance
    except Exception:
        helpers = None
        provenance = None

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())


def _safe_get(d: Optional[Dict[str, Any]], *keys, default=None):
    if not isinstance(d, dict):
        return default
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return default


def _normalize_products(pest_out: Any) -> List[Dict[str, Any]]:
    """
    Accept either dict with "products" key or a list directly.
    Returns list of product dicts.
    """
    if pest_out is None:
        return []
    if isinstance(pest_out, dict):
        products = pest_out.get("products") or pest_out.get("items") or pest_out.get("data")
        if isinstance(products, list):
            return products
        # sometimes the dict itself is a single product
        # detect typical product keys to decide if pest_out is a product
        if any(k in pest_out for k in ("name", "active_ingredient", "target_pests", "crops")):
            return [pest_out]
        return []
    if isinstance(pest_out, list):
        return [p for p in pest_out if isinstance(p, dict)]
    return []


def _matches_pest(product: Dict[str, Any], pest_names: List[str]) -> bool:
    """
    Return True if any pest in pest_names is found in product['target_pests'] using case-insensitive substring matching.
    If product has no target list, we return False.
    """
    if not pest_names:
        return False
    targets = product.get("target_pests") or product.get("targets") or product.get("pests") or []
    if not targets:
        return False
    targets_norm = [str(t).lower() for t in targets if t is not None]
    for p in pest_names:
        if not p:
            continue
        pl = str(p).lower()
        for t in targets_norm:
            if pl in t or t in pl:
                return True
    return False


def _matches_crop(product: Dict[str, Any], crop: Optional[str]) -> bool:
    """
    Return True if product explicitly lists allowed crops and crop matches (case-insensitive substring).
    If product has no crops list, treat as unspecified (do not reject).
    """
    if not crop:
        return True  # nothing to check
    crops = product.get("crops") or product.get("allowed_crops") or product.get("crop_list") or []
    if not crops:
        return True
    cl = str(crop).lower()
    for c in crops:
        try:
            if cl in str(c).lower() or str(c).lower() in cl:
                return True
        except Exception:
            continue
    return False


def _phi_ok(phi_days: Optional[float], days_to_harvest: Optional[float]) -> Optional[bool]:
    """
    If phi_days or days_to_harvest missing, return None (unknown).
    If both present, return True if phi_days <= days_to_harvest (i.e., safe), else False.
    """
    if phi_days is None or days_to_harvest is None:
        return None
    try:
        return float(phi_days) <= float(days_to_harvest)
    except Exception:
        return None


def _product_confidence(product: Dict[str, Any], signals: Dict[str, float]) -> float:
    """
    Lightweight confidence estimation for a recommended product.

    - Normalizes boolean -> 0/1 and numeric signals to [0,1].
    - Heuristic weights: pest_match (0.4), crop_match (0.4), phi_ok (0.2).
    - If helpers.compute_confidence exists, call it with prov_entries extracted
      from product if present (product['provenance'] or product['prov']).
    - Combine helper result and heuristic (favor helper when provenance exists).
    - Return float in [0,1].
    """
    def _norm_val(v):
        # booleans -> 0/1, numbers -> clamp to [0,1], others -> 0
        try:
            if isinstance(v, bool):
                return 1.0 if v else 0.0
            val = float(v)
            # if val looks like a probability >1 (e.g., percentage), scale down if needed
            if val > 1.0 and val <= 100.0:
                val = val / 100.0
            return max(0.0, min(1.0, val))
        except Exception:
            return 0.0

    # canonical signal keys and their heuristic weights
    weights = {"pest_match": 0.4, "crop_match": 0.4, "phi_ok": 0.2}

    # normalize incoming signals (do not mutate original)
    norm_signals = {k: _norm_val(v) for k, v in (signals or {}).items()}

    # compute heuristic weighted average (fallback to 0.5 if no known signals)
    total_w = 0.0
    weighted = 0.0
    for k, w in weights.items():
        val = norm_signals.get(k, None)
        if val is not None:
            weighted += w * val
            total_w += w
    heuristic_conf = float(weighted / total_w) if total_w > 0 else 0.5

    # attempt to get provenance entries from product if present
    prov_entries = []
    try:
        if isinstance(product, dict):
            prov_entries = product.get("provenance") or product.get("prov") or []
            # if single dict, wrap it
            if isinstance(prov_entries, dict):
                prov_entries = [prov_entries]
        if not isinstance(prov_entries, list):
            prov_entries = []
    except Exception:
        prov_entries = []

    # try to call helpers.compute_confidence if available and sensible
    helper_conf = None
    try:
        if helpers is not None and hasattr(helpers, "compute_confidence"):
            # pass normalized signals and provenance entries
            helper_conf = helpers.compute_confidence({"handler_confidence": heuristic_conf, "items_mean_score": heuristic_conf, "facts_mean_confidence": 0.8})
            helper_conf = float(helper_conf)
    except Exception:
        helper_conf = None

    # combine helper and heuristic:
    # - if helper_conf present and we have provenance, favor helper (70/30)
    # - if helper_conf present but no provenance, still use helper but favor heuristic (30/70)
    # - if no helper_conf, use heuristic
    if helper_conf is not None:
        if prov_entries:
            combined = 0.7 * helper_conf + 0.3 * heuristic_conf
        else:
            combined = 0.3 * helper_conf + 0.7 * heuristic_conf
    else:
        combined = heuristic_conf

    # clamp & return
    combined = max(0.0, min(1.0, float(combined)))
    return round(combined, 4)


def handle(*,intent: Any, facts: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main handler entrypoint.

    Inputs:
      - intent: dict or pydantic model (we prefer to read 'crop' or 'pest' from it if available)
      - facts: mapping of tool_name -> tool_output (expected keys: pesticide_lookup [required], rag_search [optional], calendar_lookup [optional])

    Output: dict with action 'pesticide_safe_recommendation', items list, confidence, notes, missing if applicable.
    """
    # validate
    if not facts or not isinstance(facts, dict):
        return {"action": "require_more_info", "items": [], "confidence": 0.0, "notes": "No facts provided", "missing": ["pesticide_lookup"]}

    pesticide_out = facts.get("pesticide_lookup")
    if not pesticide_out:
        return {"action": "require_more_info", "items": [], "confidence": 0.0, "notes": "Missing required tool output 'pesticide_lookup'", "missing": ["pesticide_lookup"]}

    # try to extract crop and pest from intent (preferable)
    user_crop = None
    user_pest = None
    try:
        if isinstance(intent, dict):
            user_crop = intent.get("crop") or intent.get("crop_name")
            user_pest = intent.get("pest") or intent.get("pest_name")
        else:
            user_crop = getattr(intent, "crop", None) or getattr(intent, "crop_name", None)
            user_pest = getattr(intent, "pest", None) or getattr(intent, "pest_name", None)
    except Exception:
        user_crop = user_crop or None
        user_pest = user_pest or None

    # fallback: check rag_search for detected pests
    rag = facts.get("rag_search") or facts.get("rag") or facts.get("extension_notes")
    pests_from_rag = []
    if rag and isinstance(rag, dict):
        # look for 'detected_pests' or 'pests' or 'identified_pests'
        pests_from_rag = rag.get("detected_pests") or rag.get("pests") or rag.get("identified_pests") or []
        if isinstance(pests_from_rag, str):
            pests_from_rag = [pests_from_rag]
        if not isinstance(pests_from_rag, list):
            pests_from_rag = []

    # calendar for PHI / days-to-harvest
    calendar = facts.get("calendar_lookup") or {}
    days_to_harvest = None
    try:
        # try several possible fields
        dt = None
        if isinstance(intent, dict):
            dt = intent.get("days_to_harvest") or intent.get("days_until_harvest")
        else:
            dt = getattr(intent, "days_to_harvest", None)
        if dt is None:
            dt = calendar.get("days_to_harvest") or calendar.get("days_until_harvest") or calendar.get("days_to_maturity")
        if dt is not None:
            days_to_harvest = float(dt)
    except Exception:
        days_to_harvest = None

    # normalize products
    products = _normalize_products(pesticide_out)
    if not products:
        return {"action": "require_more_info", "items": [], "confidence": 0.0, "notes": "No products found in pesticide_lookup", "missing": []}

    # build list of candidate products with deterministic filtering
    candidates = []
    for p in products:
        try:
            # product name
            pname = _safe_get(p, "name") or _safe_get(p, "product_name") or _safe_get(p, "title") or "unknown_product"
            # allowed crops check
            crop_ok = _matches_crop(p, user_crop)
            # pest match: user_pest OR rag-detected pests
            pests_to_check = []
            if user_pest:
                pests_to_check.append(user_pest)
            pests_to_check.extend(pests_from_rag or [])
            pest_ok = None
            if pests_to_check:
                pest_ok = _matches_pest(p, pests_to_check)
            else:
                pest_ok = None  # unknown, won't disqualify

            # PHI evaluation
            phi_raw = _safe_get(p, "pre_harvest_interval_days") or _safe_get(p, "phi_days") or _safe_get(p, "pre_harvest_interval")
            try:
                phi = float(phi_raw) if phi_raw is not None else None
            except Exception:
                phi = None
            phi_safe = _phi_ok(phi, days_to_harvest)

            # safety/restriction flags
            restricted = _safe_get(p, "restricted") or _safe_get(p, "is_restricted") or False
            toxicity = _safe_get(p, "toxicity_category") or _safe_get(p, "toxicity") or None

            # reasons/tradeoffs
            reasons = []
            tradeoffs = []
            meta = {
                "active_ingredient": _safe_get(p, "active_ingredient"),
                "phi_days": phi,
                "max_dosage": _safe_get(p, "max_dosage") or _safe_get(p, "dosage"),
                "allowed_crops": _safe_get(p, "crops") or _safe_get(p, "allowed_crops"),
                "restricted": bool(restricted),
                "toxicity_category": toxicity,
                "source": _safe_get(p, "source"),
            }

            # rule-based scoring signals
            signals = {}

            # crop filter effect
            if user_crop:
                if crop_ok:
                    reasons.append("compatible_with_crop")
                    signals["crop_match"] = 1.0
                else:
                    # if product lists crops and user crop not in that list -> deprioritize (set crop_match=0)
                    # but do not completely exclude (sometimes broad spectrum products)
                    reasons.append("crop_mismatch" if meta.get("allowed_crops") else "crop_unspecified")
                    signals["crop_match"] = 0.0 if meta.get("allowed_crops") else 0.5
            else:
                signals["crop_match"] = 0.5  # unknown

            # pest match effect
            if pests_to_check:
                if pest_ok:
                    reasons.append("targets_reported_pest")
                    signals["pest_match"] = 1.0
                else:
                    reasons.append("does_not_target_reported_pest" if p.get("target_pests") else "target_pests_unspecified")
                    signals["pest_match"] = 0.0 if p.get("target_pests") else 0.5
            else:
                signals["pest_match"] = 0.5  # unknown

            # phi evaluation
            if phi is not None:
                if phi_safe is True:
                    reasons.append("phi_ok")
                    signals["phi_ok"] = 1.0
                elif phi_safe is False:
                    reasons.append("phi_exceeds_days_to_harvest")
                    signals["phi_ok"] = 0.0
                    tradeoffs.append(f"PHI {phi}d > days_to_harvest {days_to_harvest}")
                else:
                    signals["phi_ok"] = 0.5
            else:
                signals["phi_ok"] = 0.5

            # restricted / toxicity reduce confidence
            if restricted:
                tradeoffs.append("restricted_use")
                signals["restricted"] = 0.0
            else:
                signals["restricted"] = 1.0

            # toxicity: if present and high-risk string or high numeric value, reduce signal
            if toxicity is not None:
                try:
                    # attempt numeric
                    tox_val = float(toxicity)
                    signals["toxicity_ok"] = 0.0 if tox_val > 3.0 else 1.0
                except Exception:
                    # textual categories: 'high', 'medium', 'low'
                    tl = str(toxicity).lower()
                    if "high" in tl:
                        signals["toxicity_ok"] = 0.0
                    elif "medium" in tl:
                        signals["toxicity_ok"] = 0.5
                    else:
                        signals["toxicity_ok"] = 1.0
            else:
                signals["toxicity_ok"] = 0.8

            # aggregate signal -> confidence for product
            prod_conf = _product_confidence(p, signals)

            # produce a candidate entry; final filtering below
            candidates.append(
                {
                    "product": p,
                    "name": pname,
                    "signals": signals,
                    "confidence": float(prod_conf),
                    "reasons": reasons,
                    "tradeoffs": tradeoffs,
                    "meta": meta,
                }
            )
        except Exception as e:
            logger.debug("Error processing pesticide product entry: %s", e, exc_info=True)
            continue

    # if no candidates, return require_more_info
    if not candidates:
        return {"action": "require_more_info", "items": [], "confidence": 0.0, "notes": "No pesticide products available after parsing.", "missing": []}

    # deterministic ranking: sort by confidence descending, but exclude clearly unsafe products:
    filtered = []
    for c in candidates:
        try:
            # exclude if phi explicitly fails (phi_safe is False) and days_to_harvest known
            phi = c["meta"].get("phi_days")
            if phi is not None and days_to_harvest is not None:
                if float(phi) > float(days_to_harvest):
                    # exclude product because PHI would be violated
                    continue
            # exclude if restricted and user context does not allow (we lack context, so keep but deprioritize)
            filtered.append(c)
        except Exception:
            continue

    if not filtered:
        return {"action": "require_more_info", "items": [], "confidence": 0.0, "notes": "All available products incompatible with PHI or restricted for this context.", "missing": []}

    # sort by confidence descending
    sorted_cands = sorted(filtered, key=lambda x: x.get("confidence", 0.0), reverse=True)

    # build DecisionItem list (top_n default 5)
    top_n = 5
    try:
        if isinstance(intent, dict):
            top_n_val = intent.get("top_n")
            if top_n_val is not None:
                top_n = int(top_n_val)
    except Exception:
        top_n = 5

    items: List[Dict[str, Any]] = []
    confidences = []
    for c in sorted_cands[:top_n]:
        prod = c.get("product") or {}
        item = {
            "name": c.get("name"),
            "score": round(float(c.get("confidence") or 0.0), 4),
            "reasons": c.get("reasons") or [],
            "tradeoffs": c.get("tradeoffs") or [],
            "meta": c.get("meta") or {},
            "sources": [],
        }
        # attach provenance: prefer product source and merged facts provenance
        try:
            src = c["meta"].get("source")
            if src:
                item["sources"].append({"source_id": src, "source_type": "catalog", "tool": "pesticide_lookup"})
        except Exception:
            pass
        # attach global merged provenance if available
        try:
            if provenance is not None and hasattr(provenance, "merge_provenance"):
                merged = provenance.merge_provenance(None, facts) or []
                # attach top relevant provenance entries (non-duplicating)
                for m in merged[:3]:
                    if m not in item["sources"]:
                        item["sources"].append(m)
        except Exception:
            pass

        items.append(item)
        confidences.append(item["score"] or 0.0)

    # overall confidence: mean of item confidences or fallback
    overall_conf = float(statistics.mean(confidences)) if confidences else 0.0

    notes = "Recommended products filtered by pest (if provided), crop compatibility and PHI constraints when available."

    return {"action": "pesticide_safe_recommendation", "items": items, "handler_confidence": round(overall_conf, 4), "confidence": None, "notes": notes}
