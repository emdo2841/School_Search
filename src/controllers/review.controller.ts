import { Response } from "express";
import { AuthRequest } from "../types/index";
import Review from "../models/review";
import School from "../models/school";
import { cacheGet, cacheSet, cacheDel } from "../utils/redis-helpers";
import { Types } from "mongoose";
 
const CACHE_TTL = 300;
 
// ── CREATE review (one per user per school) ─────────────────────
 
export const createReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { schoolId } = req.params;
    const { comment, rating } = req.body;
    const userId = req.user!.userId;
 
    const school = await School.findById(schoolId).lean();
    if (!school) {
      res.status(404).json({ success: false, message: "School not found" });
      return;
    }
 
    const existing = await Review.findOne({ school: schoolId, user: userId }).lean();
    if (existing) {
      res.status(409).json({
        success: false,
        message: "You already have a review for this school. Use PATCH to update your rating or POST a new comment.",
      });
      return;
    }
 
    const review = await Review.create({
      school: schoolId,
      user: userId,
      comments: comment ? [comment] : [],
      rating,
    });
 
    // Add review ref to the school's reviews array
    await School.findByIdAndUpdate(schoolId, { $push: { review: review._id } });
 
    await cacheDel(`reviews:school:${schoolId}`, `school:${schoolId}`);
    res.status(201).json({ success: true, message: "Review created", data: review });
  } catch (error) {
    console.error("createReview error:", error);
    res.status(500).json({ success: false, message: "Failed to create review" });
  }
};
 
// ── ADD a new comment to existing review ───────────────────────
 
export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { schoolId } = req.params;
    const { comment } = req.body;
    const userId = req.user!.userId;
 
    if (!comment || !comment.trim()) {
      res.status(400).json({ success: false, message: "Comment cannot be empty" });
      return;
    }
 
    const review = await Review.findOne({ school: schoolId, user: userId });
    if (!review) {
      res.status(404).json({
        success: false,
        message: "No review found. Create a review first before adding comments.",
      });
      return;
    }
 
    review.comments.push(comment.trim());
    await review.save();
 
    await cacheDel(`review:school:${schoolId}`);
    res.status(200).json({ success: true, message: "Comment added", data: review });
  } catch (error) {
    console.error("addComment error:", error);
    res.status(500).json({ success: false, message: "Failed to add comment" });
  }
};
 
// ── EDIT a specific comment by index ───────────────────────────
 
export const editComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { schoolId, commentIndex } = req.params;
    const { comment } = req.body;
    const userId = req.user!.userId;
    const index = parseInt(commentIndex as string);
 
    if (!comment || !comment.trim()) {
      res.status(400).json({ success: false, message: "Comment cannot be empty" });
      return;
    }
 
    const review = await Review.findOne({ school: schoolId, user: userId });
    if (!review) {
      res.status(404).json({ success: false, message: "Review not found" });
      return;
    }
 
    if (index < 0 || index >= review.comments.length) {
      res.status(400).json({ success: false, message: `Comment at index ${index} does not exist` });
      return;
    }
 
    review.comments[index] = comment.trim();
    await review.save();
 
    await cacheDel(`review:school:${schoolId}`);
    res.status(200).json({ success: true, message: "Comment updated", data: review });
  } catch (error) {
    console.error("editComment error:", error);
    res.status(500).json({ success: false, message: "Failed to edit comment" });
  }
};
 
// ── DELETE a specific comment by index ─────────────────────────
 
export const deleteComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { schoolId, commentIndex } = req.params;
    const userId = req.user!.userId;
    const index = parseInt(commentIndex as string);
 
    const review = await Review.findOne({ school: schoolId, user: userId });
    if (!review) {
      res.status(404).json({ success: false, message: "Review not found" });
      return;
    }
 
    if (index < 0 || index >= review.comments.length) {
      res.status(400).json({ success: false, message: `Comment at index ${index} does not exist` });
      return;
    }
 
    review.comments.splice(index, 1);
    await review.save();
 
    await cacheDel(`review:school:${schoolId}`);
    res.status(200).json({ success: true, message: "Comment deleted", data: review });
  } catch (error) {
    console.error("deleteComment error:", error);
    res.status(500).json({ success: false, message: "Failed to delete comment" });
  }
};
 
// ── UPDATE rating only ──────────────────────────────────────────
 
export const updateRating = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { schoolId } = req.params;
    const { rating } = req.body;
    const userId = req.user!.userId;
 
    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
      return;
    }
 
    const review = await Review.findOneAndUpdate(
      { school: schoolId, user: userId },
      { $set: { rating } },
      { new: true, runValidators: true }
    );
 
    if (!review) {
      res.status(404).json({ success: false, message: "Review not found" });
      return;
    }
 
    await cacheDel(`reviews:school:${schoolId}`);
    res.status(200).json({ success: true, message: "Rating updated", data: review });
  } catch (error) {
    console.error("updateRating error:", error);
    res.status(500).json({ success: false, message: "Failed to update rating" });
  }
};
 
// ── DELETE entire review ────────────────────────────────────────
 
export const deleteReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { schoolId } = req.params;
    const userId = req.user!.userId;
 
    const review = await Review.findOne({ school: schoolId, user: userId });
    if (!review) {
      res.status(404).json({ success: false, message: "Review not found" });
      return;
    }
 
    if (req.user!.role !== "admin" && String(review.user) !== userId) {
      res.status(403).json({ success: false, message: "Not authorised to delete this review" });
      return;
    }
 
    await Review.findByIdAndDelete(review._id);
 
    // Remove review ref from the school's reviews array
    await School.findByIdAndUpdate(schoolId, { $pull: { review: review._id } });
 
    await cacheDel(`reviews:school:${schoolId}`, `school:${schoolId}`);
    res.status(200).json({ success: true, message: "Review deleted" });
  } catch (error) {
    console.error("deleteReview error:", error);
    res.status(500).json({ success: false, message: "Failed to delete review" });
  }
};
 
// ── GET all reviews for a school ───────────────────────────────
 
export const getSchoolReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { schoolId } = req.params;
    const page  = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const skip  = (page - 1) * limit;
 
    const cacheKey = `reviews:school:${schoolId}:${page}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.status(200).json({ success: true, source: "cache", data: cached });
      return;
    }
 
    const [reviews, total] = await Promise.all([
      Review.find({ school: schoolId })
        .select("-__v")
        .skip(skip)
        .limit(limit)
        .populate("user", "first_name last_name image")
        .populate("school", "name")
        .lean(),
      Review.countDocuments({ school: schoolId }),
    ]);
 
    const ratingAgg = await Review.aggregate([
      { $match: { school: new Types.ObjectId(schoolId as string) } },
      { $group: { _id: null, avgRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } },
    ]);
 
    const stats = ratingAgg[0] || { avgRating: 0, totalReviews: 0 };
 
    const payload = {
      reviews,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      averageRating: parseFloat(Number(stats.avgRating).toFixed(1)),
      totalReviews: stats.totalReviews,
    };
 
    await cacheSet(cacheKey, payload, CACHE_TTL);
    res.status(200).json({ success: true, source: "db", data: payload });
  } catch (error) {
    console.error("getSchoolReviews error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
};
 
// ── GET logged-in user's review for a school ───────────────────
 
export const getMyReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { schoolId } = req.params;
    const userId = req.user!.userId;
 
    const review = await Review.findOne({ school: schoolId, user: userId })
      .select("-__v")
      .lean();
 
    if (!review) {
      res.status(404).json({ success: false, message: "You have not reviewed this school yet" });
      return;
    }
 
    res.status(200).json({ success: true, data: review });
  } catch (error) {
    console.error("getMyReview error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch your review" });
  }
};