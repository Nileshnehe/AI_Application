import Redis from 'ioredis';
import { ENV } from './env';

const redisClient = new Redis(ENV.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy(times){
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
});

redisClient.on('error', (err) => {
    console.log('Redis client error:', err);
});

redisClient.on('ready', () => {
    console.log('Redis connected and ready');
});

redisClient.on('reconnecting', () => {
    console.log('Redis reconnecting...');
});

export default redisClient;
