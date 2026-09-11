import app from "./app";
import { connectDB } from "./config/db";
import { ENV } from "./config/env";


const startServer = async ()  => {
    try {
        await connectDB();

        app.listen(ENV.PORT, () => {
            console.log(`Production server running on port ${ENV.PORT}`)
        })
    } catch (error) {
        console.error('startServer error', error);
        process.exit(1);
    }
};

startServer();