export async function callDecision(payload) {
  // TODO: fetch to DECISION_ENGINE_URL/decide; for now stub
  return { task: payload.intent, recommendation: { action: "Wait", reason: "stub" } };
}
