import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.schema(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [6, "Password must be at least 6 characters long"],
            select: false,
        },
        role: {
            type: String,
            enum: ["owner", "member"],
            default: "owner",
        },
        company: { type: String, trim: true, default: "" },
        avatar: { type: String, default: "" },
    },
    { timestamps: true }
);