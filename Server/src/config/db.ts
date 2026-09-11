import mongoose from 'mongoose';
import { ENV } from './env';


export const connectDB = async (): Promise<void> => {
    try {
        const conn = await mongoose.connect(ENV.MONGO_URI, {
            autoIndex: ENV.NODE_ENV !== 'production',
            serverSelectionTimeoutMS: 5000,
        });
    } catch (error) {
        console.error(' MongoDB connection failed:', error);
        process.exit(1);
    }
}