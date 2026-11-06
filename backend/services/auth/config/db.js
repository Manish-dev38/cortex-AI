import mongoose from 'mongoose';
import dns from 'node:dns';
import dotenv from 'dotenv'
dotenv.config();

// Only override resolvers when explicitly configured. Forcing public DNS by
// default breaks private VPC / split-horizon environments.
if (process.env.CUSTOM_DNS_SERVERS) {
    dns.setServers(process.env.CUSTOM_DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean));
}

const connectDb = async () => {
    mongoose.set('strictQuery', true);
    await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000
    })
    console.log("DB CONNECTED")
}

export default connectDb
