import { Router } from "express";
import {
  getAllUsers,
  getUserById,
  getMe,
  updateUser,
  uploadProfileImage,
  deleteUser,
} from "../controllers/user.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { handleValidationErrors } from "../middleware/validation.middleware";
import {
  updateUserValidation,
  mongoIdParam,
  paginationValidation,
} from "../middleware/user.validator";
import { upload } from "../cloudinary";

const router = Router();

// All user routes require authentication
router.use(authenticate);

router.get("/", authorize("admin"), paginationValidation, handleValidationErrors, getAllUsers);
router.get("/me", getMe);
router.get("/:id", mongoIdParam, authorize("admin"), handleValidationErrors, getUserById);

router.put("/:id",
  updateUserValidation,
  handleValidationErrors,
  updateUser
);

router.patch("/:id/image",
  mongoIdParam,
  handleValidationErrors,
  upload.single("image"),
  uploadProfileImage
);

router.delete("/:id",
  authorize("admin"),
  mongoIdParam,
  handleValidationErrors,
  deleteUser
);

export default router;