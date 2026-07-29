import express from 'express'
import connectDb from './config/db.js';
import 'dotenv/config';
import router from './routes/auth.route.js';
import cookieParser from 'cookie-parser';

const port = process.env.PORT || 7001;

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use("/", router)

app.get("/", (req, res) => {
  res.json({ message: "hello from Auth" });
})

function start() {
  const server = app.listen(port, () => {
    console.log(`Auth started at http://localhost:${port}`);
  });

  server.on("error", (err) => {
    console.error("Server listen error:", err);
  });

  setImmediate(() => {
    connectDb().catch((error) => {
      console.error("MongoDB connection failed:", error.message);
    });
  });
}

start();


