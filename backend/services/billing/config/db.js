import mongoose from 'mongoose';
import dns from 'node:dns';
import { config } from './env.js';

// Only override resolvers when explicitly configured. Never force public DNS
// by default, so private VPC / split-horizon environments keep working.
if (config.customDnsServers.length > 0) {
    dns.setServers(config.customDnsServers);
}

const connectDb = async () => {
    // Fail fast: callers must not open sockets when the database is down.
    // Errors propagate to the boot sequence, which exits the process.
    mongoose.set('strictQuery', true);
    await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 10000 });
    console.log("DB CONNECTED")
}

export default connectDb