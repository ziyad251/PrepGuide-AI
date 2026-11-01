const mongoose = require("mongoose")

const DEEP_DIVE_CATEGORIES = [
    "architecture",
    "technology_choices",
    "database_design",
    "api_design",
    "auth_security",
    "performance",
    "scalability",
    "error_handling",
    "real_world_scenarios",
]

const evaluationSchema = new mongoose.Schema({
    overall: { type: Number, min: 0, max: 10 },
    understanding: { type: Number, min: 0, max: 10 },
    technicalDepth: { type: Number, min: 0, max: 10 },
    accuracy: { type: Number, min: 0, max: 10 },
    communication: { type: Number, min: 0, max: 10 },
    feedback: String,
    strengths: [String],
    knowledgeGaps: [String],
    idealAnswer: String,
    // true when the AI evaluation failed and placeholder scores were stored; excluded from final scoring
    degraded: { type: Boolean, default: false },
}, { _id: false })

const turnSchema = new mongoose.Schema({
    question: { type: String, required: true },
    category: { type: String, enum: DEEP_DIVE_CATEGORIES, required: true },
    isFollowUp: { type: Boolean, default: false },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    answer: String,
    answeredAt: Date,
    evaluation: evaluationSchema,
}, { timestamps: true })

const finalReportSchema = new mongoose.Schema({
    source: { type: String, enum: ["ai", "fallback"], required: true },
    overallScore: { type: Number, min: 0, max: 100 },
    projectUnderstandingScore: { type: Number, min: 0, max: 100 },
    technicalKnowledgeScore: { type: Number, min: 0, max: 100 },
    communicationScore: { type: Number, min: 0, max: 100 },
    verdict: { type: String, enum: ["ready", "almost_ready", "needs_practice", "insufficient_data"] },
    summary: String,
    strengths: [String],
    categoryBreakdown: [{
        _id: false,
        category: { type: String, enum: DEEP_DIVE_CATEGORIES },
        score: { type: Number, min: 0, max: 100 },
        questions: Number,
    }],
    weakAreas: [{
        _id: false,
        area: String,
        reason: String,
        severity: { type: String, enum: ["low", "medium", "high"] },
    }],
    importantQuestions: [{
        _id: false,
        question: String,
        category: { type: String, enum: DEEP_DIVE_CATEGORIES },
        whyItMatters: String,
        suggestedAnswer: String,
    }],
    answeredCount: Number,
    evaluatedCount: Number,
    generatedAt: { type: Date, default: Date.now },
}, { _id: false })

const deepDiveSessionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    report: { type: mongoose.Schema.Types.ObjectId, ref: "InterviewReport", required: true },
    project: {
        projectId: { type: String, required: true },
        name: { type: String, required: true },
        summary: String,
        technologies: [String],
        highlights: [String],
        custom: { type: Boolean, default: false },
    },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    focusAreas: [{ type: String, enum: DEEP_DIVE_CATEGORIES }],
    questionLimit: { type: Number, min: 3, max: 15, default: 8 },
    status: { type: String, enum: ["active", "completed"], default: "active" },
    turns: [turnSchema],
    overallScore: { type: Number, min: 0, max: 100 },
    completedAt: Date,
    finalReport: finalReportSchema,
}, { timestamps: true })

deepDiveSessionSchema.index({ user: 1, createdAt: -1 })

module.exports = mongoose.model("DeepDiveSession", deepDiveSessionSchema)
module.exports.DEEP_DIVE_CATEGORIES = DEEP_DIVE_CATEGORIES
