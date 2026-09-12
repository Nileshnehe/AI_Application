import app from "./app";
import { connectDB } from "./config/db";
import { ENV } from "./config/env";
import redisClient from "./config/redis";


const startServer = async () => {
    try {
        await connectDB();
        await redisClient.ping();

        app.listen(ENV.PORT, () => {
            console.log(`Production server running on port ${ENV.PORT}`)
        })
    } catch (error) {
        console.error('startServer error', error);
        process.exit(1);
    }
};

startServer();