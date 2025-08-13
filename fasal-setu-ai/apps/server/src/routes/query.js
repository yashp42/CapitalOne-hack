import { Router } from "express";
import { handleQuery } from "../controllers/query.controller.js";
const r = Router();
r.post("/", handleQuery);
export default r;
