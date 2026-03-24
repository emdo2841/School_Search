import mongoose, { Types, Document, Schema } from "mongoose";

export interface IReview extends Document {
  school: Types.ObjectId;
  user: Types.ObjectId;
  comments: string[];   // user can add multiple comments
  rating: number;       // one rating per user per school, editable
}

const reviewSchema = new Schema<IReview>(
  {
    school: { type: Schema.Types.ObjectId, ref: "School", required: true },
    user:   { type: Schema.Types.ObjectId, ref: "UserSearch", required: true },
    comments: { type: [String], default: [] },
    rating: { type: Number, required: true, min: 1, max: 5 },
  },
  { timestamps: true }
);

// One review document per user per school — enforces the "one rating" rule
reviewSchema.index({ school: 1, user: 1 }, { unique: true });

const Review = mongoose.model<IReview>("Review", reviewSchema);
export default Review;