const { GoogleGenAI } = require("@google/genai")
const knowledgeDocumentModel = require("../models/knowledgeDocument.model")

let ai
const indexingRuns = new Map()
const embeddingRuns = new Map()
const EMBEDDING_MODEL = "gemini-embedding-001"
const MAX_CHUNK_LENGTH = 700
const EXTERNAL_TIMEOUT_MS = 8000

function withTimeout(promise, label, timeoutMs = EXTERNAL_TIMEOUT_MS) {
    let timeoutId
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

function getAiClient() {
    if (!process.env.GOOGLE_GENAI_API_KEY) return null
    if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY })
    return ai
}

const tokenize = (value) => new Set(String(value || "").toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").split(/\s+/).filter((token) => token.length > 2))

function lexicalScore(query, content) {
    const queryTokens = tokenize(query)
    const contentTokens = tokenize(content)
    if (!queryTokens.size || !contentTokens.size) return 0
    return [...queryTokens].filter((token) => contentTokens.has(token)).length / queryTokens.size
}

async function embed(text) {
    const client = getAiClient()
    if (!client) return null
    try {
        console.log("[RAG] embedding started", { length: String(text || "").length })
        const response = await withTimeout(
            client.models.embedContent({ model: EMBEDDING_MODEL, contents: text }),
            "Gemini embedding",
        )
        console.log("[RAG] embedding completed")
        return response.embeddings?.[0]?.values || null
    } catch (error) {
        console.error("[RAG] embedding unavailable; using lexical retrieval", { message: error.message })
        return null
    }
}

function cosineSimilarity(left, right) {
    if (!left?.length || !right?.length || left.length !== right.length) return 0
    let dot = 0
    let leftMagnitude = 0
    let rightMagnitude = 0
    for (let index = 0; index < left.length; index += 1) {
        dot += left[index] * right[index]
        leftMagnitude += left[index] ** 2
        rightMagnitude += right[index] ** 2
    }
    return leftMagnitude && rightMagnitude ? dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude)) : 0
}

function splitContent(content) {
    const text = String(content || "").trim()
    if (text.length <= MAX_CHUNK_LENGTH) return [text]
    const sentences = text.split(/(?<=[.!?])\s+/)
    const chunks = []
    let current = ""
    for (const sentence of sentences) {
        if ((current + " " + sentence).trim().length > MAX_CHUNK_LENGTH && current) {
            chunks.push(current.trim())
            current = ""
        }
        current = `${current} ${sentence}`.trim()
    }
    if (current) chunks.push(current)
    return chunks
}

function reportDocuments(report) {
    const documents = []
    const add = (sourceType, sourceId, title, content, metadata = {}) => {
        for (const [index, chunk] of splitContent(content).entries()) {
            if (chunk) documents.push({ sourceType, sourceId: `${sourceId}:${index}`, title, content: chunk, metadata })
        }
    }
    add("RESUME", String(report._id), "Candidate resume", report.resume, { reportId: String(report._id) })
    add("PROJECT", String(report._id), "Candidate profile", report.selfDescription, { reportId: String(report._id) })
    add("JOB_DESCRIPTION", String(report._id), "Target job description", report.jobDescription, { reportId: String(report._id) })
    for (const gap of report.skillGaps || []) {
        add("SKILL", `${report._id}:${gap.skill}`, `Skill: ${gap.skill}`, `${gap.skill} is a ${gap.severity} priority for this role.`, { skill: gap.skill, severity: gap.severity })
    }
    return documents
}

async function indexReport({ userId, report }) {
    const reportKey = `${String(userId)}:${String(report._id)}`
    if (indexingRuns.has(reportKey)) {
        console.log("[RAG] indexing already in progress; reusing run", { reportId: String(report._id) })
        return indexingRuns.get(reportKey)
    }
    const run = indexReportOnce({ userId, report })
    indexingRuns.set(reportKey, run)
    try {
        return await run
    } finally {
        indexingRuns.delete(reportKey)
    }
}

async function indexReportOnce({ userId, report }) {
    const documents = reportDocuments(report)
    console.log("[RAG] indexing started", { documentCount: documents.length })
    await withTimeout(Promise.all(documents.map((document) => knowledgeDocumentModel.findOneAndUpdate(
        { user: userId, sourceType: document.sourceType, sourceId: document.sourceId },
        { ...document, user: userId },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    ))), "MongoDB RAG document persistence")
    console.log("[RAG] MongoDB save completed", { documentCount: documents.length })

    const stored = await withTimeout(knowledgeDocumentModel.find({
        user: userId,
        sourceId: { $in: documents.map((document) => document.sourceId) },
    }).select("sourceType sourceId embedding").lean(), "MongoDB RAG embedding status lookup")
    const storedById = new Map(stored.map((document) => [document.sourceId, document]))
    const pending = documents.filter((document) => !storedById.get(document.sourceId)?.embedding?.length)
    console.log("[RAG] embedding plan", {
        reportId: String(report._id),
        total: documents.length,
        pending: pending.length,
        skipped: documents.length - pending.length,
    })

    // Embeddings enrich documents for future vector retrieval; lexical retrieval is
    // available immediately and must not block interview startup.
    if (embeddingRuns.has(`${String(userId)}:${String(report._id)}`)) {
        console.log("[RAG] embedding enrichment already in progress; skipping duplicate work", { reportId: String(report._id) })
        return documents.length
    }
    const embeddingKey = `${String(userId)}:${String(report._id)}`
    const enrichment = Promise.all(pending.map(async (document) => {
        const embedding = await embed(document.content)
        if (!embedding) return
        await withTimeout(knowledgeDocumentModel.findOneAndUpdate(
            { user: userId, sourceType: document.sourceType, sourceId: document.sourceId },
            { $set: { embedding } },
        ), "MongoDB embedding update")
    }))
    embeddingRuns.set(embeddingKey, enrichment)
    void enrichment.then(() => console.log("[RAG] embedding enrichment completed", { reportId: String(report._id), embedded: pending.length }))
        .catch((error) => console.error("[RAG] background embedding enrichment failed", { message: error.message }))
        .finally(() => embeddingRuns.delete(embeddingKey))
    return documents.length
}

async function indexTurnEvidence({ userId, sessionId, turn, evaluation }) {
    const items = [
        { sourceType: "INTERVIEW_ANSWER", suffix: "answer", title: "Previous interview answer", content: turn.answer, metadata: { sessionId: String(sessionId), question: turn.question } },
        { sourceType: "ASSESSMENT", suffix: "assessment", title: "Previous answer assessment", content: evaluation?.feedback, metadata: { sessionId: String(sessionId), question: turn.question } },
    ]
    for (const item of items) {
        if (!item.content) continue
        const embeddingStartedAt = Date.now()
        const embedding = await embed(item.content)
        console.log("[RAG] answer embedding completed", { sourceType: item.sourceType, elapsedMs: Date.now() - embeddingStartedAt })
        await knowledgeDocumentModel.findOneAndUpdate(
            { user: userId, sourceType: item.sourceType, sourceId: `${sessionId}:${turn._id}:${item.suffix}` },
            { user: userId, sourceId: `${sessionId}:${turn._id}:${item.suffix}`, ...item, ...(embedding ? { embedding } : {}) },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        )
    }
}

async function retrieve({ userId, query, reportId, sessionId, limit = 4 }) {
    const startedAt = Date.now()
    const scope = [{ "metadata.reportId": String(reportId) }]
    if (sessionId) scope.push({ "metadata.sessionId": String(sessionId) })
    const documents = await withTimeout(knowledgeDocumentModel.find({
        user: userId,
        ...(reportId || sessionId ? { $or: scope } : {}),
    }).lean(), "MongoDB RAG retrieval").catch((error) => {
        console.error("[RAG] MongoDB retrieval unavailable; using no retrieved context", { message: error.message })
        return []
    })
    const queryEmbedding = await embed(query)
    const scored = documents.map((document) => ({
        content: document.content,
        source: document.sourceType,
        title: document.title,
        metadata: document.metadata || {},
        relevanceScore: queryEmbedding && document.embedding
            ? cosineSimilarity(queryEmbedding, document.embedding)
            : lexicalScore(query, document.content),
    })).filter((item) => item.relevanceScore > 0).sort((left, right) => right.relevanceScore - left.relevanceScore).slice(0, limit)
    console.log("[RAG] retrieval completed", { resultCount: scored.length, mode: queryEmbedding ? "vector" : "lexical", elapsedMs: Date.now() - startedAt })
    return scored
}

function formatRetrievedContext(context) {
    if (!context?.length) return "No relevant candidate evidence was retrieved."
    return context.map((item, index) => `[${index + 1}] ${item.source} — ${item.title} (relevance ${item.relevanceScore.toFixed(2)})\n${item.content}`).join("\n\n")
}

function evaluateRetrieval(report) {
    const documents = reportDocuments(report)
    const cases = [
        { query: `${report.title} project`, expectedSource: "PROJECT" },
        { query: "backend APIs server database", expectedSource: "JOB_DESCRIPTION" },
        { query: "unrelated gardening hobby", expectedSource: null },
    ].map((testCase) => {
        const actual = documents.map((document) => ({ ...document, relevanceScore: lexicalScore(testCase.query, document.content) }))
            .filter((document) => document.relevanceScore > 0).sort((left, right) => right.relevanceScore - left.relevanceScore).slice(0, 3)
        return {
            query: testCase.query,
            expectedSource: testCase.expectedSource,
            actualSources: actual.map((document) => document.sourceType),
            relevant: testCase.expectedSource ? actual.some((document) => document.sourceType === testCase.expectedSource) : actual.length === 0,
        }
    })
    const relevant = cases.filter((item) => item.relevant).length
    return { cases, metrics: { total: cases.length, relevant, relevanceRate: Math.round(relevant / cases.length * 100) } }
}

module.exports = { indexReport, indexTurnEvidence, retrieve, formatRetrievedContext, reportDocuments, lexicalScore, evaluateRetrieval }
