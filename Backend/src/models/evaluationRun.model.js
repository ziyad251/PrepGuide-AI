const mongoose = require("mongoose")

const evaluationCaseSchema = new mongoose.Schema({
    category: String,
    name: String,
    expected: String,
    actual: String,
    passed: Boolean,
    score: Number,
    evidence: String,
    timestamp: { type: Date, default: Date.now },
}, { _id: false })

const evaluationRunSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    cases: [evaluationCaseSchema],
    summary: {
        total: Number,
        passed: Number,
        passRate: Number,
        averageScore: Number,
    },
}, { timestamps: true })

module.exports = mongoose.model("EvaluationRun", evaluationRunSchema)
