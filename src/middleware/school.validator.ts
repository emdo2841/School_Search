import { body, param, query } from "express-validator";

// ── Create ──────────────────────────────────────────────────────

export const createSchoolValidation = [
  body("name").trim().notEmpty().withMessage("School name is required"),
  body("schoolType")
    .isIn(["basic", "basic_secondary", "secondary"])
    .withMessage("schoolType must be basic, basic_secondary, or secondary"),
  body("school_method")
    .isIn(["day", "boarding", "day_and_boarding"])
    .withMessage("school_method must be day, boarding, or day_and_boarding"),
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("phone")
    .notEmpty().withMessage("Phone is required")
    .matches(/^[0-9+\-\s()]{7,15}$/).withMessage("Invalid phone number format"),
  body("state").trim().notEmpty().withMessage("State is required"),
  body("lga").trim().notEmpty().withMessage("LGA is required"),
  body("street").trim().notEmpty().withMessage("Street is required"),
];

// ── Update ──────────────────────────────────────────────────────

export const updateSchoolValidation = [
  param("id").isMongoId().withMessage("Invalid school ID"),
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
  body("schoolType")
    .optional()
    .isIn(["basic", "basic_secondary", "secondary"])
    .withMessage("Invalid schoolType"),
  body("school_method")
    .optional()
    .isIn(["day", "boarding", "day_and_boarding"])
    .withMessage("Invalid school_method"),
  body("email").optional().isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("phone")
    .optional()
    .matches(/^[0-9+\-\s()]{7,15}$/).withMessage("Invalid phone number format"),
  body("state").optional().trim().notEmpty(),
  body("lga").optional().trim().notEmpty(),
  body("street").optional().trim().notEmpty(),
];

// ── Shared ──────────────────────────────────────────────────────

export const mongoIdParam = [
  param("id").isMongoId().withMessage("Invalid school ID"),
];

export const searchSchoolValidation = [
  query("name").optional().trim().notEmpty().withMessage("Name query cannot be empty"),
  query("state").optional().trim().notEmpty(),
  query("lga").optional().trim().notEmpty(),
  query("schoolType")
    .optional()
    .isIn(["basic", "basic_secondary", "secondary"])
    .withMessage("Invalid schoolType filter"),
  query("school_method")
    .optional()
    .isIn(["day", "boarding", "day_and_boarding"])
    .withMessage("Invalid school_method filter"),
];