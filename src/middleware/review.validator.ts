import { body, param } from "express-validator";

export const createReviewValidation = [
  param("schoolId").isMongoId().withMessage("Invalid school ID"),
  body("rating")
    .notEmpty().withMessage("Rating is required")
    .isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
  body("comment").optional().trim().notEmpty().withMessage("Comment cannot be empty"),
];

export const addCommentValidation = [
  param("schoolId").isMongoId().withMessage("Invalid school ID"),
  body("comment").trim().notEmpty().withMessage("Comment is required"),
];

export const editCommentValidation = [
  param("schoolId").isMongoId().withMessage("Invalid school ID"),
  param("commentIndex")
    .isInt({ min: 0 }).withMessage("Comment index must be a non-negative integer"),
  body("comment").trim().notEmpty().withMessage("Comment cannot be empty"),
];

export const deleteCommentValidation = [
  param("schoolId").isMongoId().withMessage("Invalid school ID"),
  param("commentIndex")
    .isInt({ min: 0 }).withMessage("Comment index must be a non-negative integer"),
];

export const updateRatingValidation = [
  param("schoolId").isMongoId().withMessage("Invalid school ID"),
  body("rating")
    .notEmpty().withMessage("Rating is required")
    .isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
];

export const schoolIdParam = [
  param("schoolId").isMongoId().withMessage("Invalid school ID"),
];