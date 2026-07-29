import express from 'express'
import connectDb from './config/db.js';
import 'dotenv/config';
import router from './routes/chat.routes.js';


const port = process.env.PORT || 8002;

const app = express();
app.use(express.json());

app.use("/", router)


console.log("port=", process.env.PORT)

app.get("/", (req, res) => {
    res.json({ message: "hello from CHAT" });
})

console.log(`MONGODB URI=>:${process.env.MONGODB_URI}`)

// MONGODB_URI is provided through .env. Never commit connection strings.
async function start() {
    try {
        await connectDb();

        app.listen(port, () => {
            console.log(`CHARTED started at http://localhost:${port}`);
        });
    } catch (err) {
        console.error(err);
    }
}

start();


