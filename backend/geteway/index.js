import express from 'express'
import dotenv from 'dotenv'
import proxy from 'express-http-proxy';
dotenv.config()
import cors from 'cors'
import cookieParser from 'cookie-parser';
import getCurrentUser from './controllers/user.controller.js'
import protect from './middleware/auth.middleware.js'
import { proxyWithHeader } from './utils/proxyWithHeader.js';
import morgan from "morgan"

const port = process.env.PORT || 5000;

const app = express();
const configuredOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        // Requests without an Origin header (for example curl or server-to-server)
        // do not need browser CORS validation.
        if (!origin) return callback(null, true);

        const isLocalViteServer = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
        if (configuredOrigins.includes(origin) || isLocalViteServer) {
            return callback(null, true);
        }

        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true
}));

app.use(cookieParser());
app.use(morgan("dev"))

app.use("/api/auth", proxy(process.env.AUTH_SERVICE))
app.use("/api/chat", protect, proxyWithHeader(process.env.CHAT_SERVICE))
app.use("/api/agent", protect, proxyWithHeader(process.env.AGENT_SERVICE))
app.use("/api/billing", protect, proxyWithHeader(process.env.BILLING_SERVICE))

app.get("/api/me", protect, getCurrentUser)

app.get("/", (req, res) => {
    res.json({ message: "hello from AGteway" });
})

const server = app.listen(port, () => {
    console.log(`server is running on http://localhost:${port}`);
})


