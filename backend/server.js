import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";

import { connectDB } from "./config/db.js";
import { notFound, errorHandler } from "./middleware/error.middleware.js";

import authRoutes from "./routes/auth.routes.js";

const app = express();

// Middleware
app.use(
    cors({
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        credentials: true,
    })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

// Routes
app.get("/api/health", (req, res) => 
    res.json({ success: true, status: "ok", service: "TTP CRM API" })
);

app.use("/api/auth", authRoutes);


// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);


// Boot / Start Server
const PORT = process.env.PORT || 8000;

const start = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`TTP CRM API is running on http://localhost:${PORT}`)
        });
    } catch (error) {
        console.log("Failed to start server:", error.message);
        process.exit(1);
    }
};

start();

export default app;
