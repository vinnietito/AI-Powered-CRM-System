import mongoose from "mongoose"

export const connectDB = async () => {
    const uri = process.env.MONGO_URI;

    if (!uri) {
        throw new Error("MONGO_URI is not defined in enviroment variables");
    }

    // Avoid deprecation noise and make queries fail fast instead of buffering forever.
    mongoose.set("strictQuery", true);

    const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;

}