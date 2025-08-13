import { Router } from "express";
import { getProfile, putProfile } from "../controllers/profile.controller.js";
const r = Router();
r.get("/:id", getProfile);
r.put("/:id", putProfile);
export default r;
