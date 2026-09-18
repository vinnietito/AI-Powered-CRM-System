import { GoogleGenAI } from "@google/genai";
import { ApiError } from "../utils/ApiError.js";

let client = null;

const getClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new ApiError(
            503,
            "Gemini API Key is not configured. Add GEMINI_API_KEY to the backend .env file"
        );
    }

    if (!client) {
        client = new GoogleGenAI({
            apiKey,
        });
    }

    return client;
};

const MODEL = () =>
    process.env.GEMINI_MODEL || "gemini-3.6-flash";

export const isAIConfigured = () =>
    Boolean(process.env.GEMINI_API_KEY);

/**
 * Check whether a Gemini error is temporary and worth retrying.
 */
const isRetryableError = (err) => {
    const message = err?.message || "";
    const status =
        err?.status ||
        err?.code ||
        err?.error?.status ||
        err?.error?.code;

    return (
        status === 503 ||
        status === 429 ||
        message.includes("503") ||
        message.includes("UNAVAILABLE") ||
        message.includes("high demand") ||
        message.includes("429") ||
        message.includes("RESOURCE_EXHAUSTED") ||
        message.includes("temporarily unavailable")
    );
};

/**
 * Wait before retrying.
 */
const wait = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate structured JSON using Gemini.
 */
const generateJSON = async (prompt, schema) => {
    const ai = getClient();

    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(
                `Gemini JSON request - attempt ${attempt + 1}/${maxRetries + 1}`
            );

            const response = await ai.models.generateContent({
                model: MODEL(),
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    temperature: 0.6,
                },
            });

            if (!response?.text) {
                throw new Error("Gemini returned an empty response");
            }

            return JSON.parse(response.text);
        } catch (err) {
            console.error(
                `Gemini JSON error (attempt ${attempt + 1}/${maxRetries + 1}):`,
                err?.message || err
            );

            /*
             * If this is not a temporary Gemini error,
             * don't waste time retrying it.
             */
            if (!isRetryableError(err)) {
                throw new ApiError(
                    502,
                    "AI request failed. Please try again in a moment"
                );
            }

            /*
             * If we've used all attempts, give up.
             */
            if (attempt === maxRetries) {
                console.error(
                    "Gemini request failed after all retry attempts."
                );

                throw new ApiError(
                    502,
                    "AI service is temporarily unavailable. Please try again in a moment"
                );
            }

            /*
             * Exponential backoff:
             *
             * Attempt 1 → wait 1 second
             * Attempt 2 → wait 2 seconds
             * Attempt 3 → wait 4 seconds
             */
            const delay = Math.pow(2, attempt) * 1000;

            console.log(
                `Gemini temporarily unavailable. Retrying in ${
                    delay / 1000
                } second(s)...`
            );

            await wait(delay);
        }
    }
};

/**
 * Generate plain text using Gemini.
 */
const generateText = async (
    prompt,
    temperature = 0.7
) => {
    const ai = getClient();

    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(
                `Gemini text request - attempt ${attempt + 1}/${maxRetries + 1}`
            );

            const response = await ai.models.generateContent({
                model: MODEL(),
                contents: prompt,
                config: {
                    temperature,
                },
            });

            if (!response?.text) {
                throw new Error("Gemini returned an empty response");
            }

            return response.text.trim();
        } catch (err) {
            console.error(
                `Gemini text error (attempt ${attempt + 1}/${maxRetries + 1}):`,
                err?.message || err
            );

            if (!isRetryableError(err)) {
                throw new ApiError(
                    502,
                    "AI request failed. Please try again in a moment"
                );
            }

            if (attempt === maxRetries) {
                console.error(
                    "Gemini text request failed after all retry attempts."
                );

                throw new ApiError(
                    502,
                    "AI service is temporarily unavailable. Please try again in a moment"
                );
            }

            const delay = Math.pow(2, attempt) * 1000;

            console.log(
                `Gemini temporarily unavailable. Retrying in ${
                    delay / 1000
                } second(s)...`
            );

            await wait(delay);
        }
    }
};

/**
 * Generate AI summary for a lead.
 */
export const generateLeadSummary = async (lead) => {
    const prompt = `You are an expert B2B sales analyst for a CRM called TTP CRM.

Analyse the following sales lead and provide a concise assessment.

Lead details:

- Name: ${lead.name || "N/A"}
- Company: ${lead.company || "N/A"}
- Email: ${lead.email || "N/A"}
- Current pipeline stage: ${lead.status || "New"}
- Potential deal value: $${lead.value || 0}
- Source: ${lead.source || "Unknown"}
- Notes: ${lead.notes || "None"}

Return JSON only.`;

    const schema = {
        type: "object",
        properties: {
            summary: {
                type: "string",
                description:
                    "2-3 sentence executive summary of the lead",
            },

            riskScore: {
                type: "integer",
                description:
                    "Risk of losing this deal, 0 (safe) to 100 (high risk)",
            },

            suggestedPriority: {
                type: "string",
                enum: ["Low", "Medium", "High"],
            },

            nextBestAction: {
                type: "string",
                description:
                    "One concrete recommended next step",
            },
        },

        required: [
            "summary",
            "riskScore",
            "suggestedPriority",
            "nextBestAction",
        ],
    };

    return generateJSON(prompt, schema);
};

/**
 * Generate a sales email for a lead.
 */
export const generateEmail = async ({
    lead,
    purpose,
    tone,
    sender,
}) => {
    const prompt = `You are a senior sales representative writing on behalf of ${
        sender?.name || "our team"
    }${sender?.company ? ` at ${sender.company}` : ""}.

Write a professional email.

Purpose: ${purpose || "follow-up"}

Desired tone: ${tone || "friendly and professional"}

Recipient (lead) details:

- Name: ${lead?.name || "there"}
- Company: ${lead?.company || "N/A"}
- Pipeline stage: ${lead?.status || "New"}
- Context / notes: ${lead?.notes || "None"}

Return JSON only with a compelling subject line and a complete email body.

Use line breaks (\\n) in the body.

Keep it under 180 words.

Sign off as ${sender?.name || "the TTP CRM team"}.`;

    const schema = {
        type: "object",

        properties: {
            subject: {
                type: "string",
            },

            body: {
                type: "string",
            },
        },

        required: [
            "subject",
            "body",
        ],
    };

    return generateJSON(prompt, schema);
};

/**
 * Generate sales pipeline insights.
 */
export const generateSalesInsights = async (
    pipelineStats
) => {
    const prompt = `You are a revenue-operations advisor.

Given this snapshot of a sales pipeline, identify what is working, what is at risk, and concrete actions to improve conversion.

Pipeline snapshot (JSON):

${JSON.stringify(pipelineStats, null, 2)}

Return JSON only.`;

    const schema = {
        type: "object",

        properties: {
            headline: {
                type: "string",
                description:
                    "One-sentence summary of pipeline health",
            },

            insights: {
                type: "array",
                description:
                    "3-5 specific, data-driven observations",

                items: {
                    type: "string",
                },
            },

            recommendations: {
                type: "array",
                description:
                    "3-5 actionable recommendations",

                items: {
                    type: "string",
                },
            },

            healthScore: {
                type: "integer",
                description:
                    "Overall pipeline health, 0-100",
            },
        },

        required: [
            "headline",
            "insights",
            "recommendations",
            "healthScore",
        ],
    };

    return generateJSON(
        prompt,
        schema
    );
};

export { generateText };