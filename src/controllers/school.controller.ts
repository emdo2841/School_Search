import { Response } from "express";
import { AuthRequest } from "../types/index";
import School from "../models/school";
import Review from "../models/review";
import { cacheGet, cacheSet, cacheDel, cacheDelPattern, storeTempSchool, getTempSchool, deleteTempSchool } from "../utils/redis-helpers";
// import { validatePhoneNumber } from "../utils/phone.validator";
import { v2 as cloudinary } from "cloudinary";
import User from "../models/user";
import { sendEmail } from "../utils/mailer";
import crypto from "crypto";

const CACHE_TTL = 300;
 
export const initiateSchoolCreation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, schoolType, school_method, email, phone, state, lga, street } = req.body;
    const userId = req.user!.userId; // The authenticated user creating the school

    // Generate a secure verification token
    const token = crypto.randomBytes(32).toString("hex");

    // Store ALL the form data temporarily in Redis, including the userId who owns it
    const pendingSchoolData = { 
      name, schoolType, school_method, email, phone, state, lga, street, userId 
    };
    await storeTempSchool(token, pendingSchoolData);

    // Build the verification link
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const verificationLink = `${frontendUrl}/verify-school?token=${token}`;

    // Send the email to the SCHOOL's email address
    const message = `Hello,\n\nPlease verify this email address to complete the registration for ${name}.\n\nClick the link below to verify:\n${verificationLink}\n\nThis link will expire in 15 minutes.`;
    await sendEmail(email, "Verify Your School Registration", message);

    res.status(200).json({ 
      success: true, 
      message: "Verification email sent. Please check the school's inbox to complete registration." 
    });
  } catch (error: any) {
    console.error("initiateSchoolCreation error:", error);
    res.status(500).json({ success: false, message: "Failed to initiate school creation", error: error.message });
  }
};

export const completeSchoolCreation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ success: false, message: "Verification token is required" });
      return;
    }

    // 1. Get the pending school data from Redis
    const schoolData = await getTempSchool(token);
    if (!schoolData) {
      res.status(400).json({ success: false, message: "Verification link is invalid or has expired." });
      return;
    }

    const { name, schoolType, school_method, email, phone, state, lga, street, userId } = schoolData;

    // REMOVED: The manual check for existingSchool is gone now.

    // 2. Create the school
    const school = await School.create({
      name,
      schoolType,
      school_method,
      email,
      phone,
      state: state.toLowerCase(),
      lga: lga.toLowerCase(),
      street,
      user: userId, 
      review: [], 
    });

   // 3. Link school back to the user (Using $addToSet for arrays)
    await User.findByIdAndUpdate(userId, { $addToSet: { school: school._id } });
    sendEmail(email, "School Registration Complete", `Congratulations! Your school "${name}" has been successfully registered and linked to your account.`);

    // 4. Cleanup Redis token so it can't be clicked twice
    await deleteTempSchool(token);

    // 5. Clear caches
    await cacheDelPattern("schools:page:*");   
    await cacheDelPattern("schools:search:*"); 
    await cacheDelPattern("schools:nearby:*"); 
    await cacheDel(`user:${userId}`); 

    res.status(201).json({ success: true, message: "School created successfully!", data: school });
  } catch (error: any) {
    console.error("completeSchoolCreation error:", error);
    
    // Kept the 11000 check just in case other fields (like _id) clash, 
    // but changed the message since it won't be about the email anymore.
    if (error.code === 11000) {
      if (req.body.token) await deleteTempSchool(req.body.token); 
      res.status(400).json({ success: false, message: "A duplicate record error occurred." });
      return;
    }

    res.status(500).json({ success: false, message: "Failed to create school", error: error.message });
  }
}; 

// ── GET ALL ─────────────────────────────────────────────────────

export const getAllSchools = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page  = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const skip  = (page - 1) * limit;

    const cacheKey = `schools:page:${page}:limit:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.status(200).json({ success: true, source: "cache", data: cached });
      return;
    }

    const [schools, total] = await Promise.all([
      School.find()
        .select("-__v")
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(limit)
        .populate("user", "first_name last_name email")
        .populate({
          path: "review", // Fixed typo: was "review"
          perDocumentLimit: 2,
          select: "user comments rating createdAt", // Explicitly select review fields
          populate: {
            path: "user", // Nested population for the review's author
            select: "first_name last_name image" // Get specific user details
          }
        })
        .lean(),
      School.countDocuments(),
    ]);

    const payload = { schools, total, page, totalPages: Math.ceil(total / limit) };
    await cacheSet(cacheKey, payload, CACHE_TTL);

    res.status(200).json({ success: true, source: "db", data: payload });
  } catch (error) {
    console.error("getAllSchools error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch schools" });
  }
};
 
// ── GET SINGLE ──────────────────────────────────────────────────

export const getSchoolById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const cacheKey = `school:${id}`;

    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.status(200).json({ success: true, source: "cache", data: cached });
      return;
    }

    const school = await School.findById(id)
      .select("-__v")
      .populate("user", "first_name last_name email")
      .populate({
          path: "review",
          perDocumentLimit: 2,
          select: "user comments rating createdAt", // Explicitly select review fields
          populate: {
            path: "user", // Nested population for the review's author
            select: "first_name last_name image" // Get specific user details
          }
      })
      .lean();

    if (!school) {
      res.status(404).json({ success: false, message: "School not found" });
      return;
    }

    await cacheSet(cacheKey, school, CACHE_TTL);
    res.status(200).json({ success: true, source: "db", data: school });
  } catch (error) {
    console.error("getSchoolById error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch school" });
  }
};
 
// ── UPDATE ──────────────────────────────────────────────────────
 
export const updateSchool = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
 
    const school = await School.findById(id).lean();
    if (!school) {
      res.status(404).json({ success: false, message: "School not found" });
      return;
    }
 
    if (req.user!.role !== "admin" && String(school.user) !== req.user!.userId) {
      res.status(403).json({ success: false, message: "Not authorised to update this school" });
      return;
    }
 
    if (req.body.state) req.body.state = req.body.state.toLowerCase();
    if (req.body.lga)   req.body.lga   = req.body.lga.toLowerCase();
 
    const updated = await School.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true, select: "-__v" }
    ).lean();
 // Replace the old cacheDel with this:
    await cacheDelPattern("schools:page:*");
    await cacheDelPattern("schools:search:*");
    await cacheDelPattern("schools:nearby:*");
    await cacheDel(`school:${id}`);
    res.status(200).json({ success: true, message: "School updated", data: updated });
  } catch (error) {
    console.error("updateSchool error:", error);
    res.status(500).json({ success: false, message: "Failed to update school" });
  }
};
 
// ── UPLOAD IMAGES ───────────────────────────────────────────────
 
export const uploadSchoolImages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
 
    const school = await School.findById(id).lean();
    if (!school) {
      res.status(404).json({ success: false, message: "School not found" });
      return;
    }
 
    if (req.user!.role !== "admin" && String(school.user) !== req.user!.userId) {
      res.status(403).json({ success: false, message: "Not authorised to upload images for this school" });
      return;
    }
 
    if (!req.files || !(req.files as Express.Multer.File[]).length) {
      res.status(400).json({ success: false, message: "No image files provided" });
      return;
    }
 
    const newUrls = (req.files as (Express.Multer.File & { path: string })[]).map((f) => f.path);
 
    const updated = await School.findByIdAndUpdate(
      id,
      { $push: { image: { $each: newUrls } } },
      { new: true, select: "-__v" }
    ).lean();
 
    await cacheDel(`school:${id}`);
    res.status(200).json({ success: true, message: "Images uploaded", data: updated });
  } catch (error) {
    console.error("uploadSchoolImages error:", error);
    res.status(500).json({ success: false, message: "Failed to upload images" });
  }
};
 
// ── DELETE IMAGE ────────────────────────────────────────────────
 
export const deleteSchoolImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { imageUrl } = req.body;
 
    if (!imageUrl) {
      res.status(400).json({ success: false, message: "imageUrl is required" });
      return;
    }
 
    const school = await School.findById(id).lean();
    if (!school) {
      res.status(404).json({ success: false, message: "School not found" });
      return;
    }
 
    if (req.user!.role !== "admin" && String(school.user) !== req.user!.userId) {
      res.status(403).json({ success: false, message: "Not authorised" });
      return;
    }
 
    const publicId = imageUrl.split("/").pop()?.split(".")[0];
    if (publicId) await cloudinary.uploader.destroy(`schools/${publicId}`).catch(() => null);
 
    await School.findByIdAndUpdate(id, { $pull: { image: imageUrl } });
    await cacheDel(`school:${id}`);
 
    res.status(200).json({ success: true, message: "Image deleted" });
  } catch (error) {
    console.error("deleteSchoolImage error:", error);
    res.status(500).json({ success: false, message: "Failed to delete image" });
  }
};
 
// ── DELETE SCHOOL ───────────────────────────────────────────────
 
export const deleteSchool = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
 
    const school = await School.findById(id).lean();
    if (!school) {
      res.status(404).json({ success: false, message: "School not found" });
      return;
    }
 
    if (req.user!.role !== "admin" && String(school.user) !== req.user!.userId) {
      res.status(403).json({ success: false, message: "Not authorised to delete this school" });
      return;
    }
 
    // Delete all Cloudinary images in parallel — use allSettled so one failure doesn't block the rest
    if (school.image?.length) {
      await Promise.allSettled(
        school.image.map((url) => {
          const publicId = url.split("/").pop()?.split(".")[0];
          return publicId ? cloudinary.uploader.destroy(`schools/${publicId}`) : Promise.resolve();
        })
      );
    }
 
    // Delete all reviews that belong to this school
    await Review.deleteMany({ school: id });
 
    // Remove specific school ref from the owner's user document (Using $pull)
    await User.findByIdAndUpdate(school.user, { $pull: { school: id } });
 
    await School.findByIdAndDelete(id);
    await cacheDelPattern("schools:page:*");
    await cacheDelPattern("schools:search:*");
    await cacheDelPattern("schools:nearby:*");
    await cacheDel(`school:${id}`, `user:${String(school.user)}`);
 
    res.status(200).json({ success: true, message: "School deleted" });
  } catch (error) {
    console.error("deleteSchool error:", error);
    res.status(500).json({ success: false, message: "Failed to delete school" });
  }
};
 
// ── SEARCH ──────────────────────────────────────────────────────
 
export const searchSchools = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, state, lga, schoolType, school_method } = req.query as Record<string, string>;
    const page  = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const skip  = (page - 1) * limit;
 
    const filter: Record<string, unknown> = {};
 
    if (name)          filter.$text         = { $search: name };
    if (state)         filter.state         = state.toLowerCase();
    if (lga)           filter.lga           = lga.toLowerCase();
    if (schoolType)    filter.schoolType    = schoolType;
    if (school_method) filter.school_method = school_method;
 
    const cacheKey = `schools:search:${JSON.stringify(filter)}:${page}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.status(200).json({ success: true, source: "cache", data: cached });
      return;
    }
 
    const [schools, total] = await Promise.all([
      School.find(filter)
        .select("-__v")
        .skip(skip)
        .limit(limit)
        .populate("user", "first_name last_name email")
        .lean(),
      School.countDocuments(filter),
    ]);
 
    const payload = { schools, total, page, totalPages: Math.ceil(total / limit) };
    await cacheSet(cacheKey, payload, CACHE_TTL);
 
    res.status(200).json({ success: true, source: "db", data: payload });
  } catch (error) {
    console.error("searchSchools error:", error);
    res.status(500).json({ success: false, message: "Search failed" });
  }
};
 
// ── NEARBY SCHOOLS ──────────────────────────────────────────────
 
export const getNearbySchools = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.userId) {
      res.status(401).json({ 
        success: false, 
        message: "Unauthorized: User information missing from request" 
      });
      return;
    }
    const userId = req.user!.userId;
 
    const user = await User.findById(userId).select("state lga").lean();
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
 
    const { state, lga } = user;
    const cacheKey = `schools:nearby:${state}:${lga}`;
 
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.status(200).json({ success: true, source: "cache", data: cached });
      return;
    }
 
    const [sameLga, sameState] = await Promise.all([
      School.find({ state, lga }).select("-__v").limit(20).lean(),
      School.find({ state, lga: { $ne: lga } }).select("-__v").limit(20).lean(),
    ]);
 
    const payload = {
      same_lga:   sameLga,
      same_state: sameState,
    };
 
    await cacheSet(cacheKey, payload, CACHE_TTL);
    res.status(200).json({ success: true, source: "db", data: payload });
  } catch (error) {
    console.error("getNearbySchools error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch nearby schools" });
  }
};