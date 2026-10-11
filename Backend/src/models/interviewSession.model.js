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
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    focus: String,
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

const interviewSessionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    report: { type: mongoose.Schema.Types.ObjectId, ref: "InterviewReport", required: true },
    targetRole: { type: String, required: true },
    interviewType: { type: String, enum: ["technical", "behavioral", "mixed"], required: true },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    status: { type: String, enum: ["active", "completed"], default: "active" },
    currentDifficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    turns: [turnSchema],
    skillProfile: [skillMetricSchema],
    topSkillGaps: [String],
}, { timestamps: true })

module.exports = mongoose.model("InterviewSession", interviewSessionSchema)
