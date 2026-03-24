import mongoose, { Types, Document, Schema } from "mongoose";

export interface ISchool extends Document {
  name: string;
  schoolType: "basic" | "basic_secondary" | "secondary";
  school_method: "day" | "boarding" | "day_and_boarding";
  image: string[];
  email: string;
  phone: string;
  state: string;
  lga: string;
  street: string;
  user: Types.ObjectId;
  review: Types.ObjectId[]; // array — a school has many reviews
}

const schoolSchema = new Schema<ISchool>(
  {
    name:  { type: String, required: true, trim: true },
    image: { type: [String], default: [] },
    schoolType: {
      type: String,
      enum: ["basic", "basic_secondary", "secondary"],
      required: true,
    },
    school_method: {
      type: String,
      enum: ["day", "boarding", "day_and_boarding"],
      required: true,
    },
    email:  { type: String, required: true, lowercase: true, trim: true },
    phone:  { type: String, required: true },
    state:  { type: String, required: true, trim: true, lowercase: true },
    lga:    { type: String, required: true, trim: true, lowercase: true },
    street: { type: String, required: true, trim: true },
    user:   { type: Schema.Types.ObjectId, ref: "UserSearch", required: true },
    review: [{ type: Schema.Types.ObjectId, ref: "Review" }], // array of review refs
  },
  { timestamps: true }
);

schoolSchema.index({ name: "text" });
schoolSchema.index({ state: 1, lga: 1 });


const School = mongoose.model<ISchool>("School", schoolSchema);
export default School;