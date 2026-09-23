import { Lead } from "../models/Lead.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {
    generateLeadSummary,
    generateEmail,
    generateSalesInsights,
    isAIConfigured,
} from "../services/ai.service.js";

const resolveLead = async (req) => {
    if (req.body.leadId) {
        const lead = await Lead.findOne({ _id: req.body.leadId, owner: req.user._id });
        if (!lead) throw new ApiError(404, "Lead not found");
            return lead;
        }
        if (req.body.lead) return req.body.lead;
        throw new ApiError(400, "Provide a leadId or an inline lead object");
    };

const buildFallbackLeadSummary = (lead) => {
    const status = lead.status || "New";
    const priority = lead.priority || "Medium";
    const value = Number(lead.value) || 0;
    const hasNotes = Boolean(lead.notes?.trim());
    const riskByStatus = {
        New: 55,
        Qualified: 35,
        Proposal: 45,
        Won: 5,
        Lost: 95,
    };
    const riskScore = Math.min(
        100,
        Math.max(0, riskByStatus[status] + (hasNotes ? -5 : 10))
    );

    let nextBestAction = "Confirm the lead's needs and schedule a discovery call.";
    if (status === "Qualified") {
        nextBestAction = "Follow up with a tailored proposal and confirm decision criteria.";
    } else if (status === "Proposal") {
        nextBestAction = "Contact the lead to address proposal questions and agree on a decision date.";
    } else if (status === "Won") {
        nextBestAction = "Confirm the handoff and agree on the onboarding timeline.";
    } else if (status === "Lost") {
        nextBestAction = "Record the reason for the loss and schedule a future re-engagement if appropriate.";
    }

    return {
        fallback: true,
        summary: `${lead.name || "This lead"} is in the ${status} stage with ${priority.toLowerCase()} priority${value ? ` and a potential value of KSh ${Math.round(value * 129.5).toLocaleString("en-KE")}` : ""}.`,
        riskScore,
        suggestedPriority:
            status === "Won" || status === "Lost"
                ? "Low"
                : riskScore >= 60
                ? "High"
                : priority,
        nextBestAction,
    };
};

    export const aiStatus = asyncHandler(async (req, res) => {
        res.json({
            success: true,
            configured: isAIConfigured(),
            model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
        });
    });

    export const leadSummary = asyncHandler(async (req, res) => {
        const lead = await resolveLead(req);
        let result;

        try {
            result = await generateLeadSummary(lead);
        } catch (error) {
            if (error.statusCode !== 429) throw error;
            result = buildFallbackLeadSummary(lead);
        }

        if (req.body.leadId) {
            await Lead.updateOne(
                { _id: req.body.leadId, owner: req.user._id },
                { $set: { aiSummary: result.summary, aiRiskScore: result.riskScore } }
            );
        }

        res.json({ success: true, ...result});
    });

    export const generateEmailDraft = asyncHandler(async (req, res) => {
        const lead = await resolveLead(req);
        const { purpose, tone } = req.body;

        const result = await generateEmail({
            lead,
            purpose,
            tone,
            sender: { name: req.user.name, company: req.user.company },
        });

        res.json({ success: true, ...result });
    });    

    export const salesInsights = asyncHandler(async (req, res) => {
        let stats = req.body.stats;

        if (!stats) {
            const leads = await Lead.find({ owner: req.user._id});
            stats = buildPipelineStats(leads);
        }

        try {
            const result = await generateSalesInsights(stats);
            res.json({ success: true, ...result });
        } catch (error) {
            if (error.statusCode !== 429) throw error;

            res.json({
                success: true,
                fallback: true,
                ...buildFallbackSalesInsights(stats),
            });
        }
        });

        const buildPipelineStats = (leads) => {
            const byStage = {};
            let totalValue = 0;
            for (const l of leads) {
                byStage[l.status] = byStage[l.status] || { count: 0, value: 0 };
                byStage[l.status].count += 1;
                byStage[l.status].value += l.value || 0;
                totalValue += l.value || 0;
            }
            const won = byStage.Won?.count || 0;
            const lost = byStage.Lost?.count || 0;
            const closed = won + lost;
            return {
                totalLeads: leads.length,
                totalPipelineValue: totalValue,
                winRate: closed > 0 ? Math.round((won / closed) * 100) : 0,
                stages: byStage,
            };
        };

        const buildFallbackSalesInsights = (stats) => {
            const stages = stats.stages || {};
            const won = stages.Won?.count || 0;
            const lost = stages.Lost?.count || 0;
            const open = Math.max((stats.totalLeads || 0) - won - lost, 0);
            const winRate = stats.winRate || 0;

            const insights = [
                `${stats.totalLeads || 0} leads are currently in the pipeline, with ${open} still open.`,
                `The current win rate is ${winRate}%, based on ${won + lost} closed leads.`,
            ];

            if (open > 0) {
                insights.push(`${open} open leads represent the next opportunity for conversion.`);
            } else {
                insights.push("There are no open leads requiring immediate follow-up.");
            }

            const recommendations = [
                "Prioritize follow-up on open leads with the highest deal value.",
                "Review lost opportunities for recurring objections and process improvements.",
                "Keep lead stages and next actions up to date so the pipeline remains forecastable.",
            ];

            return {
                headline:
                    winRate >= 50
                        ? "Your pipeline is converting well; focus on expanding the open opportunity set."
                        : "Your pipeline has room to improve conversion; prioritize qualified open opportunities.",
                insights,
                recommendations,
                healthScore: Math.min(
                    100,
                    Math.max(0, Math.round(winRate * 0.7 + (open > 0 ? 30 : 10)))
                ),
            };
        };