import mongoose from 'mongoose';
import dns from 'node:dns';
import dotenv from 'dotenv'
dotenv.config();

// Force Google DNS — fixes SRV lookup failures on Jio/Reliance networks
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDb = async () => {
    await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000
    })
    console.log("DB CONNECTED")
}

export default connectDb
