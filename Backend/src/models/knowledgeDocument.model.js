const mongoose = require("mongoose")

const knowledgeDocumentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
    sourceType: {
        type: String,
        enum: ["RESUME", "PROJECT", "SKILL", "JOB_DESCRIPTION", "INTERVIEW_ANSWER", "ASSESSMENT", "KNOWLEDGE"],
        required: true,
    },
    sourceId: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    embedding: { type: [Number], default: undefined },
}, { timestamps: true })

knowledgeDocumentSchema.index({ user: 1, sourceType: 1, sourceId: 1 }, { unique: true })

module.exports = mongoose.model("KnowledgeDocument", knowledgeDocumentSchema)
