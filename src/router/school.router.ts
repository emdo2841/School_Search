import { Router } from "express";
import {
  initiateSchoolCreation,
  completeSchoolCreation,
  getAllSchools,
  getSchoolById,
  updateSchool,
  uploadSchoolImages,
  deleteSchoolImage,
  deleteSchool,
  searchSchools,
  getNearbySchools,
} from "../controllers/school.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { handleValidationErrors } from "../middleware/validation.middleware";
import {
  createSchoolValidation,
  updateSchoolValidation,
  mongoIdParam,
  searchSchoolValidation,
} from "../middleware/school.validator";
import { upload } from "../cloudinary";
import { apiLimiter } from "../middleware/rate-limiter";

const router = Router();

// All routes require authentication

// ── Search & discovery (before /:id to avoid route conflicts) ──
router.get("/search",  searchSchoolValidation, handleValidationErrors, searchSchools);
router.get("/nearby", authenticate,  getNearbySchools);   // uses JWT to get user's state/lga

// ── CRUD ────────────────────────────────────────────────────────
router.get("/",   getAllSchools);
router.get("/:id", mongoIdParam, handleValidationErrors, getSchoolById);

router.post("/initiate", authenticate,
  upload.none(), // <-- Add this to parse multipart text fields before validation
  createSchoolValidation,
  handleValidationErrors,
  initiateSchoolCreation
);
router.post("/complete", authenticate,
  upload.none(), // <-- Add this to parse multipart text fields before validation
  completeSchoolCreation
);

router.put("/:id", authenticate,
  upload.none(), // <-- Add this to parse multipart text fields before validation
  updateSchoolValidation,
  handleValidationErrors,
  updateSchool
);

// Upload multiple images (max 10)
router.patch("/:id/images",
  authenticate,// <-- Add this to parse multipart text fields before validation
  mongoIdParam,
  handleValidationErrors,
  upload.array("images", 10),
  uploadSchoolImages
);

// Delete a single image by URL
router.delete("/:id/images",
  authenticate,
  upload.none(), // <-- Add this to parse multipart text fields before validation
  mongoIdParam,
  handleValidationErrors,
  deleteSchoolImage
);

router.delete("/:id", authenticate,
  upload.none(), // <-- Add this to parse multipart text fields before validation
  mongoIdParam,
  handleValidationErrors,
  deleteSchool
);

export default router;