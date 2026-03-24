import { redisClient } from "../redis";

const CACHE_TTL = 300; // 5 minutes
const REFRESH_TTL = 60 * 60 * 24 * 7; // 7 days

// ── Cache helpers ──────────────────────────────────────────────

export const cacheGet = async <T>(key: string): Promise<T | null> => {
  const data = await redisClient.get(key);
  return data ? (JSON.parse(data) as T) : null;
};

export const cacheSet = async (key: string, value: unknown, ttl = CACHE_TTL): Promise<void> => {
  await redisClient.setEx(key, ttl, JSON.stringify(value));
};

export const cacheDel = async (...keys: string[]): Promise<void> => {
  if (keys.length) await redisClient.del(keys);
};

export const cacheDelPattern = async (pattern: string): Promise<void> => {
  try {
    const keysToDelete: string[] = [];

    // 1. Safely scan for keys matching the pattern in batches
    for await (const chunk of redisClient.scanIterator({
      MATCH: pattern,
      COUNT: 100
    })) {
      // Use the spread operator (...) to push the array of strings into our flat list
      keysToDelete.push(...chunk); 
    }

    // 2. If we found matching keys, delete them all at once
    if (keysToDelete.length > 0) {
      const deletedCount = await redisClient.del(keysToDelete);
      console.log(`[Redis] Successfully deleted ${deletedCount} keys matching "${pattern}"`);
    } else {
      console.log(`[Redis] No keys found matching "${pattern}"`);
    }

  } catch (error) {
    console.error(`[Redis] Error deleting pattern ${pattern}:`, error);
  }
};

// ── Refresh token store ────────────────────────────────────────

export const storeRefreshToken = async (userId: string, token: string): Promise<void> => {
  await redisClient.setEx(`refresh:${userId}`, REFRESH_TTL, token);
};

export const getStoredRefreshToken = async (userId: string): Promise<string | null> => {
  return redisClient.get(`refresh:${userId}`);
};

export const deleteRefreshToken = async (userId: string): Promise<void> => {
  await redisClient.del(`refresh:${userId}`);
};

// ── Access token blacklist (logout) ───────────────────────────

export const blacklistToken = async (token: string, expiresInSeconds: number): Promise<void> => {
  await redisClient.setEx(`bl:${token}`, expiresInSeconds, "1");
};

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  const result = await redisClient.get(`bl:${token}`);
  return result === "1";
};

// Store the email and password temporarily (expires in 15 mins)
export const storeTempUser = async (token: string, data: { email: string; password: string }): Promise<void> => {
  await redisClient.setEx(`reg_token:${token}`, 15 * 60, JSON.stringify(data));
};

// Retrieve the temporary data using the token
export const getTempUser = async (token: string): Promise<{ email: string; password: string } | null> => {
  const data = await redisClient.get(`reg_token:${token}`);
  return data ? JSON.parse(data) : null;
};

// Delete the temporary data after successful registration
export const deleteTempUser = async (token: string): Promise<void> => {
  await redisClient.del(`reg_token:${token}`);
};

// Store the reset token tied to the user's ID (Expires in 15 mins)
export const storeResetToken = async (token: string, userId: string): Promise<void> => {
  await redisClient.setEx(`reset_token:${token}`, 15 * 60, userId);
};

// Retrieve the user ID using the token
export const getResetToken = async (token: string): Promise<string | null> => {
  return await redisClient.get(`reset_token:${token}`);
};

// Delete the token after a successful password reset
export const deleteResetToken = async (token: string): Promise<void> => {
  await redisClient.del(`reset_token:${token}`);
};

// Store the pending school data (Expires in 15 mins)
export const storeTempSchool = async (token: string, data: any): Promise<void> => {
  await redisClient.setEx(`temp_school:${token}`, 15 * 60, JSON.stringify(data));
};

// Retrieve the school data using the token
export const getTempSchool = async (token: string): Promise<any | null> => {
  const data = await redisClient.get(`temp_school:${token}`);
  return data ? JSON.parse(data) : null;
};

// Delete the temporary data after successful creation
export const deleteTempSchool = async (token: string): Promise<void> => {
  await redisClient.del(`temp_school:${token}`);
};