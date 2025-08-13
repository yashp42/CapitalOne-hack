import { transcribe } from "../services/stt.service.js";
import { synthesize } from "../services/tts.service.js";

export async function stt(req, res) {
  const { audioBase64, lang } = req.body || {};
  const text = await transcribe({ audioBase64, lang });
  res.json({ text, lang });
}

export async function tts(req, res) {
  const { text, lang } = req.body || {};
  const audioBase64 = await synthesize({ text, lang });
  res.json({ audioBase64, mime: "audio/wav" });
}
