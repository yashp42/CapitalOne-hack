import { Router } from "express";
import { stt, tts } from "../controllers/voice.controller.js";
const r = Router();
r.post("/stt", stt);
r.post("/tts", tts);
export default r;
