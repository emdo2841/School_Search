import { Response } from "express";
import { AuthRequest } from "../types/index";
import User from "../models/user";
import { cacheGet, cacheSet, cacheDel } from "../utils/redis-helpers";
import { v2 as cloudinary } from "cloudinary";

const USER_CACHE_TTL = 300;
 
// ── GET ALL ─────────────────────────────────────────────────────
// ── GET ALL (CURSOR-BASED PAGINATION) ───────────────────────────
export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit as string) || 12);
    const cursor = req.query.cursor as string;

    // Build the query: If we have a cursor, find users older than that cursor
    const query: any = {};
    if (cursor) {
      query._id = { $lt: cursor }; 
    }

    // Cache key now depends on the limit and cursor
    const cacheKey = `users:limit:${limit}:cursor:${cursor || 'first'}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.status(200).json({ success: true, source: "cache", data: cached });
      return;
    }

    // Fetch users sorted by newest first
    const users = await User.find(query)
      .select("-__v")
      .sort({ _id: -1 }) // Sort newest first
      .limit(limit)
      .lean();

    // Determine the next cursor (the ID of the very last user in this batch)
    // If the array is smaller than the limit, we know we've reached the end!
    const nextCursor = users.length === limit ? users[users.length - 1]._id : null;

    const payload = { users, nextCursor };
    await cacheSet(cacheKey, payload, USER_CACHE_TTL);

    res.status(200).json({ success: true, source: "db", data: payload });
  } catch (error) {
    console.error("getAllUsers error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
};
// ── GET SINGLE ──────────────────────────────────────────────────
export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const cacheKey = `user:${id}`;

    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.status(200).json({ success: true, source: "cache", data: cached });
      return;
    }

    // ADDED: .populate("school") so public profiles show associated schools
    const user = await User.findById(id).select("-__v").populate("school").lean();
    
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    await cacheSet(cacheKey, user, USER_CACHE_TTL);
    res.status(200).json({ success: true, source: "db", data: user });
  } catch (error) {
    console.error("getUserById error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch user" });
  }
};
 
// ── GET ME ──────────────────────────────────────────────────────
 
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const cacheKey = `user:${userId}`;
 
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.status(200).json({ success: true, source: "cache", data: cached });
      return;
    }
 
    const user = await User.findById(userId)
      .select("-__v")
      .populate("school", "name email phone state lga street schoolType school_method image")
      .lean();
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
 
    await cacheSet(cacheKey, user, USER_CACHE_TTL);
    res.status(200).json({ success: true, source: "db", data: user });
  } catch (error) {
    console.error("getMe error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch profile" });
  }
};
 
// ── UPDATE ──────────────────────────────────────────────────────
 
export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
 
    if (req.user!.role !== "admin" && req.user!.userId !== id) {
      res.status(403).json({ success: false, message: "You can only update your own profile" });
      return;
    }
 
    if (req.body.role && req.user!.role !== "admin") {
      delete req.body.role;
    }
 
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true, select: "-__v" }
    ).lean();
 
    if (!updatedUser) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
 
    await cacheDel(`user:${id}`);
    res.status(200).json({ success: true, message: "User updated", data: updatedUser });
  } catch (error) {
    console.error("updateUser error:", error);
    res.status(500).json({ success: false, message: "Failed to update user" });
  }
};
 
// ── UPLOAD PROFILE IMAGE ────────────────────────────────────────
 
export const uploadProfileImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
 
    if (req.user!.role !== "admin" && req.user!.userId !== id) {
      res.status(403).json({ success: false, message: "Cannot update another user's image" });
      return;
    }
 
    if (!req.file) {
      res.status(400).json({ success: false, message: "No image file provided" });
      return;
    }
 
    const imageUrl = (req.file as Express.Multer.File & { path: string }).path;
 
    const existing = await User.findById(id).select("image").lean();
    if (existing?.image) {
      const publicId = existing.image.split("/").pop()?.split(".")[0];
      if (publicId) await cloudinary.uploader.destroy(`users/${publicId}`).catch(() => null);
    }
 
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: { image: imageUrl } },
      { new: true, select: "-__v" }
    ).lean();
 
    if (!updatedUser) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
 
    await cacheDel(`user:${id}`);
    res.status(200).json({ success: true, message: "Profile image updated", data: updatedUser });
  } catch (error) {
    console.error("uploadProfileImage error:", error);
    res.status(500).json({ success: false, message: "Failed to upload image" });
  }
};
 
// ── DELETE ──────────────────────────────────────────────────────
 
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
 
    const user = await User.findByIdAndDelete(id).lean();
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
 
    if (user.image) {
      const publicId = user.image.split("/").pop()?.split(".")[0];
      if (publicId) await cloudinary.uploader.destroy(`users/${publicId}`).catch(() => null);
    }
 
    await cacheDel(`user:${id}`);
    res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("deleteUser error:", error);
    res.status(500).json({ success: false, message: "Failed to delete user" });
  }
};