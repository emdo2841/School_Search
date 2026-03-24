import { createClient } from 'redis';
import dotenv from "dotenv";

dotenv.config();

// 1. Export the client so your Express routes can use it to fetch/save data!
export const redisClient = createClient({
    username: 'default',
    password: process.env.REDIS_PASSWORD, // Typo fixed!
    socket: {
        host: process.env.REDIS_HOST,
        port: 13065
    }
});

// 2. Syntax fixed! No need for the misplaced 'async'
redisClient.on('error', (err) => console.log('Redis Client Error', err));

// 3. Wrapped in an async function to call when your server starts
export const connectToRedis = async () => {
    try {
        await redisClient.connect();
        console.log("Redis connected successfully");
    } catch (error) {
        console.error("Failed to connect to Redis:", error);
    }
};