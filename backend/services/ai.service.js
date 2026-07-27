import { GoogleGenAI } from "@google/genai";
import { ApiError } from "../utils/ApiError.js";

let client = null;

const getClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new ApiError(
            503,
            "Gemini API Key is not configured. Add GEMINI_API_KEY to the backend .env file "
        );
    }
    if (!client) client =  new GoogleGenAI(apiKey);
    return client;
};

const MODEL = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";

export const isAIConfigured = () => Boolean(process.env.GEMINI_API_KEY);


const generateJSON = async (prompt, schema) => {
    const ai = getClient();
    try {
        
    }
}