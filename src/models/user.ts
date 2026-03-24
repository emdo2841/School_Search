  import mongoose, { Types, Document, Schema } from "mongoose";
  import bcrypt from "bcryptjs";

  export interface IUser extends Document {
    first_name: string;
    last_name: string;
    role: "admin" | "user" | "school_owner";
    image?: string;
    email: string;
    password: string;
    state: string;
    lga: string;
    phone: string;
    street: string;
    school?: Types.ObjectId[];
    comparePassword(candidate: string): Promise<boolean>;
  }

  const userSchema = new Schema<IUser>(
    {
      first_name: { type: String, required: true, trim: true },
      last_name:  { type: String, required: true, trim: true },
      image:      { type: String },
      role:       { type: String, enum: ["admin", "user", "school owner"] },
      email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
      phone:      { type: String, required: true, unique: true, trim: true },
      password:   { type: String, required: true, select: false },
      state:      { type: String, required: true, trim: true },
      lga:        { type: String, required: true, trim: true },
      street:     { type: String, required: true, trim: true },
      school:    [{ type: Schema.Types.ObjectId, ref: 'School' }],
    },
    { timestamps: true }
  );

  // FIX 1: Removed 'next' and CallbackWithoutResultAndOptionalError
  userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    
    // Hash the password
    this.password = await bcrypt.hash(this.password, 12);
  });

  // FIX 2: Explicitly type the method as async for better TypeScript support
  userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
    // Remember to use .select("+password") in your login controller!
    return bcrypt.compare(candidate, this.password);
  };


  const User = mongoose.model<IUser>("UserSearch", userSchema);
  export default User;