import { body, param, query } from "express-validator";

// ── Auth ────────────────────────────────────────────────────────

export const initialRegValidation = [
  
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[A-Z])(?=.*[0-9])/)
    .withMessage("Password must contain at least one uppercase letter and one number"),
];
// Add this new validation specifically for the completion step
export const completeRegisterValidation = [
  body("token").notEmpty().withMessage("Token is required"),
  body("first_name").trim().notEmpty().withMessage("First name is required"),
  body("last_name").trim().notEmpty().withMessage("Last name is required"),
  body("phone").trim().notEmpty().withMessage("Phone is required"),
  body("state").trim().notEmpty().withMessage("State is required"),
  body("lga").trim().notEmpty().withMessage("LGA is required"),
  body("street").trim().notEmpty().withMessage("Street is required"),
  body("role").isIn(["admin", "user", "school owner"]).withMessage("Invalid role"),
];

export const loginValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

export const refreshTokenValidation = [
  body("refreshToken").notEmpty().withMessage("Refresh token is required"),
];

// ── User CRUD ───────────────────────────────────────────────────

export const updateUserValidation = [
  param("id").isMongoId().withMessage("Invalid user ID"),
  body("first_name").optional().trim().notEmpty().withMessage("First name cannot be empty"),
  body("last_name").optional().trim().notEmpty().withMessage("Last name cannot be empty"),
  body("email").optional().isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("state").optional().trim().notEmpty(),
  body("lga").optional().trim().notEmpty(),
  body("street").optional().trim().notEmpty(),
  body("role")
    .optional()
    .isIn(["admin", "user", "school_owner"])
    .withMessage("Invalid role"),
];

export const mongoIdParam = [
  param("id").isMongoId().withMessage("Invalid user ID"),
];

export const paginationValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be 1–100"),
];