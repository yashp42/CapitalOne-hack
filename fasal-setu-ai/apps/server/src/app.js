import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// Import routes
import userRoutes from "./routes/user.routes.js";
import queryRoutes from "./routes/query.js";
import voiceRoutes from "./routes/voice.js";
import cropRoutes from "./routes/crop.routes.js";

// Import middleware
import errorHandler from "./middleware/errorHandler.middleware.js";

const app = express();

app.use(cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000", "https://capital-one-hack-pied.vercel.app"],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200
}));

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: true, limit: "20kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Routes
app.use("/api/users", userRoutes);
app.use("/api/query", queryRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/crops", cropRoutes);

// Health check
app.get("/health", (req, res) => {
    res.status(200).json({ status: "OK", message: "Server is running" });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export { app };