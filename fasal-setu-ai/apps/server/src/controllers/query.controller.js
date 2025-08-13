import { callAIEngine } from "../services/aiEngine.client.js";
import { callDecision } from "../services/decision.client.js";
import { callLLM2 } from "../services/llm2.client.js";

export async function handleQuery(req, res) {
  try {
    const { query, userId, mode, locale, profile } = req.body || {};
    const plan = await callAIEngine({ query, profile });
    const decision = await callDecision({ intent: plan.intent, facts: plan.facts, profile });
    const formatted = await callLLM2({ structuredDecision: decision, audienceHints: { locale, mode } });
    res.json({ ok: true, ...formatted });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "internal_error" });
  }
}
