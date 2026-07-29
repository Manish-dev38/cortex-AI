import express from 'express';
import 'dotenv/config';
import connectDb from './config/db.js';
import router from './routes/agent.route.js';


const port = process.env.PORT || 3001;

const app = express();
app.use(express.json());

app.use("/", router)


console.log("port=", process.env.PORT)

app.get("/", (req, res) => {
    res.json({ message: "hello from AGENT" });
})

// console.log(`MONGODB URI=>:${process.env.MONGODB_URI}`)

// MONGODB_URI is provided through .env. Never commit connection strings.
async function start() {
    try {
        await connectDb();

        app.listen(port, () => {
            console.log(`AGENT started at http://localhost:${port}`);
        });
    } catch (err) {
        console.error(err);
    }
}

start();


