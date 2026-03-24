import { Router } from "express";
import {
  createReview,
  addComment,
  editComment,
  deleteComment,
  updateRating,
  deleteReview,
  getSchoolReviews,
  getMyReview,
} from "../controllers/review.controller";
import { authenticate } from "../middleware/auth.middleware";
import { handleValidationErrors } from "../middleware/validation.middleware";
import {
  createReviewValidation,
  addCommentValidation,
  editCommentValidation,
  deleteCommentValidation,
  updateRatingValidation,
  schoolIdParam,
} from "../middleware/review.validator";


// Add { mergeParams: true } right here!
const router = Router({ mergeParams: true });

router.use(authenticate);

// All routes are scoped under /api/schools/:schoolId/reviews

router.get("/", schoolIdParam, handleValidationErrors, getSchoolReviews);
router.get("/me", schoolIdParam, handleValidationErrors, getMyReview);

router.post("/", createReviewValidation, handleValidationErrors, createReview);
router.post("/comment", addCommentValidation, handleValidationErrors, addComment);

router.patch("/comment/:commentIndex", editCommentValidation, handleValidationErrors, editComment);
router.patch("/rating", updateRatingValidation, handleValidationErrors, updateRating);

router.delete("/comment/:commentIndex", deleteCommentValidation, handleValidationErrors, deleteComment);
router.delete("/", schoolIdParam, handleValidationErrors, deleteReview);

export default router;