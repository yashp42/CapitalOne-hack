import express from "express";
import cors from "cors";
import health from "./routes/health.js";
import query from "./routes/query.js";
import profile from "./routes/profile.js";
import voice from "./routes/voice.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use("/health", health);
app.use("/query", query);
app.use("/profile", profile);
app.use("/voice", voice);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`[server] listening on :${port}`));
