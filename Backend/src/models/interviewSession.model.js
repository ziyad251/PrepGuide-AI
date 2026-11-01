const mongoose = require("mongoose")

const evidenceSchema = new mongoose.Schema({
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "InterviewSession" },
    questionId: String,
    type: { type: String, enum: ["evidence", "strength", "gap"] },
    description: String,
    score: { type: Number, min: 0, max: 10 },
    timestamp: { type: Date, default: Date.now },
}, { _id: false })

const evaluationSchema = new mongoose.Schema({
    overall: { type: Number, min: 0, max: 10 },
    technicalAccuracy: { type: Number, min: 0, max: 10 },
    depth: { type: Number, min: 0, max: 10 },
    clarity: { type: Number, min: 0, max: 10 },
    relevance: { type: Number, min: 0, max: 10 },
    strengths: [String],
    missingConcepts: [String],
    recommendedTopics: [String],
    feedback: String,
    // true when the AI evaluation failed and placeholder scores were stored; excluded from final scoring
    degraded: { type: Boolean, default: false },
    skillsAssessed: [{
        skill: String,
        category: String,
        score: { type: Number, min: 0, max: 10 },
        confidence: { type: Number, min: 0, max: 1 },
        evidence: [String],
        strengths: [String],
        gaps: [String],
    }],
}, { _id: false })

const turnSchema = new mongoose.Schema({
    question: { type: String, required: true },
    answer: String,
    answeredAt: Date,
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    focus: String,
    isFollowUp: { type: Boolean, default: false },
    ragContext: [{
        content: String,
        source: String,
        title: String,
        relevanceScore: Number,
        metadata: mongoose.Schema.Types.Mixed,
    }],
    nextFocus: String,
    nextDifficulty: { type: String, enum: ["easy", "medium", "hard"] },
    evaluation: evaluationSchema,
}, { timestamps: true })

const skillMetricSchema = new mongoose.Schema({
    skill: { type: String, required: true },
    category: String,
    importance: { type: String, enum: ["low", "medium", "high"] },
    source: [{ type: String, enum: ["resume", "job_description", "interview", "self_reported"] }],
    baselineScore: { type: Number, min: 0, max: 100 },
    currentScore: { type: Number, min: 0, max: 100 },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    evidence: [evidenceSchema],
    strengths: [String],
    gaps: [evidenceSchema],
    questionsAsked: { type: Number, default: 0 },
    lastAssessedAt: Date,
    status: { type: String, enum: ["unassessed", "assessed", "gap"] },
}, { _id: false })

const scoreSchema = new mongoose.Schema({
    technicalCorrectness: { type: Number, min: 0, max: 100 },
    communication: { type: Number, min: 0, max: 100 },
    problemSolving: { type: Number, min: 0, max: 100 },
    relevance: { type: Number, min: 0, max: 100 },
}, { _id: false })

const finalReportSchema = new mongoose.Schema({
    source: { type: String, enum: ["ai", "fallback"], required: true },
    overallScore: { type: Number, min: 0, max: 100 },
    scores: scoreSchema,
    verdict: { type: String, enum: ["ready", "almost_ready", "needs_practice", "insufficient_data"] },
    summary: String,
    strengths: [String],
    weaknesses: [String],
    improvements: [String],
    idealAnswers: [{
        _id: false,
        question: String,
        answerSummary: String,
        idealAnswer: String,
        keyPoints: [String],
        score: { type: Number, min: 0, max: 10 },
    }],
    topicsToRevise: [{
        _id: false,
        topic: String,
        reason: String,
        priority: { type: String, enum: ["low", "medium", "high"] },
    }],
    answeredCount: Number,
    evaluatedCount: Number,
    generatedAt: { type: Date, default: Date.now },
}, { _id: false })

const interviewSessionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    report: { type: mongoose.Schema.Types.ObjectId, ref: "InterviewReport", required: true },
    targetRole: { type: String, required: true },
    interviewType: { type: String, enum: ["technical", "hr", "behavioral", "mixed"], required: true },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    status: { type: String, enum: ["active", "completed"], default: "active" },
    questionLimit: { type: Number, min: 3, max: 15, default: 8 },
    currentDifficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    turns: [turnSchema],
    skillProfile: [skillMetricSchema],
    topSkillGaps: [String],
    // denormalised from finalReport so history lists can show scores without loading reports
    overallScore: { type: Number, min: 0, max: 100 },
    completedAt: Date,
    finalReport: finalReportSchema,
}, { timestamps: true })

interviewSessionSchema.index({ user: 1, createdAt: -1 })
interviewSessionSchema.index({ user: 1, report: 1, status: 1 })

module.exports = mongoose.model("InterviewSession", interviewSessionSchema)
