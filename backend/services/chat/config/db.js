import mongoose from 'mongoose';
import dns from 'node:dns';
import dotenv from 'dotenv'
dotenv.config();

// Force Google DNS — fixes SRV lookup failures on Jio/Reliance networks
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDb = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI)
        console.log("DB CONNECTED")
    } catch (error) {
        console.log(error)
    }
}

export default connectDb