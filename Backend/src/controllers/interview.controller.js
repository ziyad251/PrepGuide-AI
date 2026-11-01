const mongoose = require("mongoose")
const pdfParse = require("pdf-parse")
const { generateInterviewReport, generateResumePdf, generateUpdatedPreparationPlan } = require("../services/ai.service")
const { generateOpeningQuestion, generateSkillInventory, evaluateAnswer, generateFinalReport, evaluationSchema } = require("../services/simulator.service")
const { normalizeInventory, updateSkillProfile, rankSkillGaps, selectNextFocus } = require("../services/skill.service")
const interviewReportModel = require("../models/interviewReport.model")
const interviewSessionModel = require("../models/interviewSession.model")
const evaluationRunModel = require("../models/evaluationRun.model")
const { indexReport, indexTurnEvidence, retrieve, evaluateRetrieval } = require("../services/rag.service")
const { claimTurnAnswer, releaseTurnAnswer } = require("../services/sessionTurn.service")




/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterViewReportController(req, res) {
    try {
        console.log("[UPLOAD] file received", {
            present: Boolean(req.file),
            field: req.file?.fieldname || "",
            name: req.file?.originalname || "",
            size: req.file?.size || 0,
            type: req.file?.mimetype || "",
        })
        const { selfDescription, jobDescription } = req.body
        if (!req.file && !selfDescription?.trim()) {
            return res.status(400).json({ message: "Upload a PDF resume or provide a self-description." })
        }
        if (req.file && req.file.mimetype !== "application/pdf") {
            return res.status(400).json({ message: "Resume must be a PDF file." })
        }
        if (!jobDescription?.trim()) {
            return res.status(400).json({ message: "Job description is required." })
        }

        console.log("[RESUME] extraction started", { present: Boolean(req.file) })
        const resumeContent = req.file
            ? await new pdfParse.PDFParse({ data: req.file.buffer }).getText()
            : { text: "No resume uploaded. Use the self-description as the candidate profile." }
        console.log("[RESUME] extraction completed", { characters: resumeContent.text.length })
        const interViewReportByAi = await generateInterviewReport({
            resume: resumeContent.text,
            selfDescription,
            jobDescription
        })
        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeContent.text,
            selfDescription,
            jobDescription,
            ...interViewReportByAi
        })
        console.log("[REPORT] created", { reportId: String(interviewReport._id), hasResume: Boolean(interviewReport.resume) })

        res.status(201).json({ message: "Interview report generated successfully.", interviewReport })
    } catch (error) {
        console.error("Interview report generation failed:", error)
        res.status(502).json({
            message: "Interview report generation failed. Check the backend AI and database configuration.",
            detail: process.env.NODE_ENV === "production" ? undefined : error.message,
        })
    }

}

/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {

    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    res.status(200).json({
        message: "Interview report fetched successfully.",
        interviewReport
    })
}


/** 
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan -projects")

    res.status(200).json({
        message: "Interview reports fetched successfully.",
        interviewReports
    })
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
    const { interviewReportId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewReportId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const { resume, jobDescription, selfDescription } = interviewReport

    const pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
    })

    res.send(pdfBuffer)
}

/**
 * @description Delete an interview report owned by the current user.
 */
async function deleteInterviewReportController(req, res) {
    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOneAndDelete({
        _id: interviewId,
        user: req.user.id,
    })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found.",
        })
    }

    res.status(200).json({
        message: "Interview report deleted successfully.",
    })
}

async function startSimulatorController(req, res) {
    const startedAt = Date.now()
    const requestId = req.get("x-request-id") || `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    try {
        console.log("[SIMULATOR] start", { requestId })
        const { reportId, targetRole, interviewType = "technical", difficulty = "medium", questionLimit = 8, resume = "", selfDescription = "", jobDescription = "" } = req.body
        console.log("SIMULATOR_START", { reportId: Boolean(reportId), targetRole, interviewType, difficulty, userId: Boolean(req.user?.id) })
        console.log("[SIMULATOR] report loading started", { reportId: reportId || null })
        let report = reportId ? await interviewReportModel.findOne({ _id: reportId, user: req.user.id }) : null
        console.log("[SIMULATOR] report loading completed", { found: Boolean(report) })
        if (reportId && !report) return res.status(404).json({ message: "Interview report not found." })
        if (!report) {
            if (!jobDescription.trim()) return res.status(400).json({ message: "A job description is required when starting without an interview report." })
            report = await interviewReportModel.create({
                user: req.user.id,
                title: targetRole || "Target role",
                resume,
                selfDescription,
                jobDescription,
                matchScore: null,
                technicalQuestions: [],
                behavioralQuestions: [],
                skillGaps: [],
                preparationPlan: [],
            })
        }
        console.log("PROFILE_LOADED", { reportId: String(report._id), hasResume: Boolean(report.resume), hasJobDescription: Boolean(report.jobDescription), hasSelfDescription: Boolean(report.selfDescription) })
        console.log("[PERF] START_REPORT_READY", { elapsedMs: Date.now() - startedAt, requestId })
        try {
            console.log("[RAG] report indexing started", { reportId: String(report._id) })
            await indexReport({ userId: req.user.id, report })
            console.log("[RAG] report indexing completed", { reportId: String(report._id) })
        } catch (error) {
            console.error("RAG report indexing failed; continuing without semantic index", { message: error.message })
        }
        const initialSkillProfile = normalizeInventory([], report)
        console.log("[PERF] START_SKILLS_READY", { elapsedMs: Date.now() - startedAt, requestId, blocking: false, scheduled: true })
        console.log("OPENING_QUESTION_REQUEST", { targetRole: targetRole || report.title, interviewType, difficulty })
        let ragContext = []
        const retrievalStartedAt = Date.now()
        try {
            ragContext = await retrieve({
                userId: req.user.id,
                reportId: report._id,
                query: `${targetRole || report.title} ${interviewType} interview ${difficulty} ${report.jobDescription}`,
            })
        } catch (error) {
            console.error("RAG opening retrieval failed; continuing without retrieved context", { message: error.message })
        }
        console.log("[RAG] startup retrieval timing", { elapsedMs: Date.now() - retrievalStartedAt, requestId })
        console.log("[PERF] START_RAG_READY", { elapsedMs: Date.now() - startedAt, requestId })
        console.log("[LLM] opening question started")
        const openingStartedAt = Date.now()
        const opening = await generateOpeningQuestion({ targetRole: targetRole || report.title, interviewType, difficulty, resume: report.resume, jobDescription: report.jobDescription, retrievedContext: ragContext })
        console.log("[LLM] opening question completed", { elapsedMs: Date.now() - openingStartedAt, requestId })
        console.log("[PERF] START_LLM_READY", { elapsedMs: Date.now() - startedAt, requestId })
        console.log("OPENING_QUESTION_VALIDATED", { focus: opening.focus, difficulty: opening.difficulty })
        const session = await interviewSessionModel.create({
            user: req.user.id, report: report._id, targetRole: targetRole || report.title, interviewType, difficulty, questionLimit,
            currentDifficulty: opening.difficulty || difficulty,
            turns: [{ question: opening.question, focus: opening.focus, difficulty: opening.difficulty || difficulty, ragContext }],
            skillProfile: initialSkillProfile, topSkillGaps: [],
        })
        console.log("SESSION_CREATED", { sessionId: String(session._id), skillCount: session.skillProfile.length, requestId })
        console.log("[SIMULATOR] response ready", { requestId, elapsedMs: Date.now() - startedAt })
        console.log("[PERF] START_RESPONSE_READY", { elapsedMs: Date.now() - startedAt, requestId })
        res.status(201).json({ session })
        void generateSkillInventory({ resume: report.resume, selfDescription: report.selfDescription, jobDescription: report.jobDescription, report })
            .then(async (inventory) => {
                const skillProfile = normalizeInventory(inventory.skills, report)
                await interviewSessionModel.updateOne(
                    { _id: session._id, user: req.user.id },
                    { $set: { skillProfile } },
                )
                console.log("SKILL_INVENTORY_BUILT", { count: inventory.skills.length, elapsedMs: Date.now() - startedAt, requestId, blocking: false })
            })
            .catch((error) => console.error("Background skill inventory persistence failed", { message: error.message, requestId }))
    } catch (error) {
        console.error("SIMULATOR_START_ERROR", { name: error.name, message: error.message })
        res.status(502).json({ message: "Could not start the simulator.", detail: process.env.NODE_ENV === "production" ? undefined : error.message })
    }
}

async function answerSimulatorController(req, res) {
    const startedAt = Date.now()
    console.log("[PERF] ANSWER_REQUEST_BEGIN", { elapsedMs: 0 })
    const session = await interviewSessionModel.findOne({ _id: req.params.sessionId, user: req.user.id }).populate("report")
    if (!session) return res.status(404).json({ message: "Interview session not found." })
    if (session.status === "completed") return res.status(400).json({ message: "Interview session is already complete." })
    if (!session.report) return res.status(409).json({ message: "The interview plan for this session was deleted." })
    const { answer } = req.body
    const turnIndex = session.turns.length - 1
    const currentTurn = session.turns[turnIndex]
    if (currentTurn.answer) return res.status(409).json({ message: "This question has already been answered. Finish the interview to see your report." })
    const claimed = await claimTurnAnswer(interviewSessionModel, { sessionId: session._id, userId: req.user.id, turnIndex, answer })
    if (!claimed) return res.status(409).json({ message: "This answer is already being processed." })
    currentTurn.answer = answer
    currentTurn.answeredAt = new Date()
    console.log("[PERF] ANSWER_SAVED", { elapsedMs: Date.now() - startedAt })
    try {
        let ragContext = []
        try {
            ragContext = await retrieve({
                userId: req.user.id,
                reportId: session.report._id,
                sessionId: session._id,
                query: `${session.targetRole} ${currentTurn.focus || ""} ${currentTurn.question} ${answer}`,
            })
        } catch (error) {
            console.error("RAG answer retrieval failed; continuing without retrieved context", { message: error.message })
        }
        console.log("[PERF] ANSWER_RAG_READY", { elapsedMs: Date.now() - startedAt })
        const answeredCount = session.turns.filter((turn) => turn.answer).length
        const readyToFinish = answeredCount >= session.questionLimit
        const questionStartedAt = Date.now()
        const result = await evaluateAnswer({ session, turn: currentTurn, answer, resume: session.report.resume, jobDescription: session.report.jobDescription, retrievedContext: ragContext, needsNextQuestion: !readyToFinish })
        console.log("[LLM] question generation timing", { elapsedMs: Date.now() - questionStartedAt })
        console.log("[PERF] ANSWER_LLM_READY", { elapsedMs: Date.now() - startedAt })
        currentTurn.evaluation = result
        currentTurn.ragContext = ragContext
        const updatedProfile = updateSkillProfile(session.skillProfile, result.skillsAssessed, session._id, currentTurn._id)
        session.skillProfile = updatedProfile
        const rankedGaps = rankSkillGaps(updatedProfile)
        session.topSkillGaps = rankedGaps.map((gap) => gap.skill)
        const nextFocus = selectNextFocus(updatedProfile, result.nextFocus)
        session.currentDifficulty = result.nextDifficulty
        currentTurn.nextFocus = nextFocus
        currentTurn.nextDifficulty = result.nextDifficulty
        if (!readyToFinish) {
            session.turns.push({ question: result.nextQuestion, focus: nextFocus, difficulty: result.nextDifficulty, isFollowUp: result.nextQuestionType === "follow_up", ragContext })
        }
        await session.save()
        console.log("[SIMULATOR] answer flow completed", { elapsedMs: Date.now() - startedAt })
        console.log("[PERF] ANSWER_RESPONSE_READY", { elapsedMs: Date.now() - startedAt })
        res.status(200).json({ session, readyToFinish, evaluation: { ...result, nextFocus, skillGaps: rankedGaps } })
        if (!result.degraded) {
            void indexTurnEvidence({ userId: req.user.id, sessionId: session._id, turn: currentTurn, evaluation: result })
                .then(() => console.log("[PERF] ANSWER_EMBEDDED", { elapsedMs: Date.now() - startedAt }))
                .catch((error) => console.error("Background RAG turn indexing failed", { message: error.message }))
        }
    } catch (error) {
        console.error("SIMULATOR_ANSWER_ERROR", { name: error.name, message: error.message })
        await releaseTurnAnswer(interviewSessionModel, { sessionId: session._id, userId: req.user.id, turnIndex })
        res.status(502).json({ message: "We couldn't process your answer. Your draft is still here; please submit it again.", detail: process.env.NODE_ENV === "production" ? undefined : error.message })
    }
}

/**
 * @description Finish a mock interview and generate its final report. Idempotent: a completed
 * session returns its stored report, and a fallback report is regenerated on request.
 */
async function finishSimulatorController(req, res) {
    const session = await interviewSessionModel.findOne({ _id: req.params.sessionId, user: req.user.id }).populate("report", "resume selfDescription jobDescription")
    if (!session) return res.status(404).json({ message: "Interview session not found." })
    if (session.finalReport?.source === "ai" || (session.finalReport && !req.body?.regenerate)) {
        return res.status(200).json({ session })
    }
    if (!session.turns.some((turn) => turn.answer)) {
        return res.status(400).json({ message: "Answer at least one question before finishing the interview." })
    }
    // drop the trailing unanswered question so the transcript matches what the candidate saw and answered
    if (!session.turns[session.turns.length - 1].answer) session.turns.pop()
    const finalReport = await generateFinalReport({ session, report: session.report })
    session.finalReport = finalReport
    session.overallScore = finalReport.overallScore ?? undefined
    session.status = "completed"
    session.completedAt = session.completedAt || new Date()
    await session.save()
    console.log("[REPORT] mock interview report ready", { sessionId: String(session._id), source: finalReport.source })
    res.status(200).json({ session })
}

async function getSimulatorController(req, res) {
    const session = await interviewSessionModel.findOne({ _id: req.params.sessionId, user: req.user.id })
    if (!session) return res.status(404).json({ message: "Interview session not found." })
    res.status(200).json({ session })
}

const evaluationCases = [
    { category: "Answer Evaluation", name: "Correct JWT explanation", answer: "JWT is a signed, stateless token. The server verifies its signature and claims on each request.", expected: "high score and no major gap" },
    { category: "Answer Evaluation", name: "Incomplete answer", answer: "We use access tokens.", expected: "medium or low score with a specific missing concept" },
    { category: "Answer Evaluation", name: "JWT misconception", answer: "JWT encryption means nobody can read the payload.", expected: "low technical accuracy and correction" },
    { category: "Context Retention", name: "Off-topic answer", answer: "I enjoy hiking on weekends and recently visited a new trail.", expected: "low relevance" },
    { category: "Difficulty Adaptation", name: "Strong answer increases difficulty", answer: "JWT is signed, not encrypted. I would use short-lived access tokens, rotate refresh tokens, revoke them on reuse, and validate issuer, audience, and expiry.", expected: "difficulty increases or remains appropriately challenging" },
    { category: "Skill Gap Detection", name: "Repeated weakness remains targeted", answer: "I do not know how refresh token rotation or reuse detection works.", expected: "specific gap is detected" },
]

async function runEvaluationSuiteController(req, res) {
    const report = await interviewReportModel.findOne({ user: req.user.id }).sort({ createdAt: -1 })
    if (!report) return res.status(404).json({ message: "Generate an interview report before running the evaluation suite." })
    const fakeSession = { targetRole: report.title, interviewType: "technical", currentDifficulty: "medium", turns: [] }
    const cases = []
    for (const testCase of evaluationCases) {
        const result = await evaluateAnswer({ session: fakeSession, turn: { question: "Explain JWT authentication and token lifecycle." }, answer: testCase.answer, resume: report.resume, jobDescription: report.jobDescription })
        const passed = testCase.name === "Correct JWT explanation" ? result.overall >= 7 && result.relevance >= 7
            : testCase.name === "Off-topic answer" ? result.relevance <= 4
                : testCase.name === "Strong answer increases difficulty" ? ["medium", "hard"].includes(result.nextDifficulty)
                    : result.missingConcepts.length > 0 || result.skillsAssessed.some((skill) => skill.gaps.length > 0)
        cases.push({ category: testCase.category, name: testCase.name, expected: testCase.expected, actual: result.feedback, passed, score: result.overall, evidence: result.missingConcepts.join(", "), timestamp: new Date() })
    }
    const invalidValidation = evaluationSchema.safeParse({ overall: "not-a-number" })
    cases.push({ category: "Structured Output", name: "Invalid structured output is rejected", expected: "schema validation fails safely", actual: invalidValidation.success ? "accepted" : "rejected", passed: !invalidValidation.success, score: 0, evidence: invalidValidation.success ? "" : "Zod rejected malformed output", timestamp: new Date() })
    const passed = cases.filter((item) => item.passed).length
    const summary = { total: cases.length, passed, passRate: Math.round(passed / cases.length * 100), averageScore: Math.round(cases.reduce((sum, item) => sum + item.score, 0) / cases.length * 10) / 10 }
    const run = await evaluationRunModel.create({ user: req.user.id, cases, summary })
    res.status(201).json({ run })
}

async function getEvaluationSuiteController(req, res) {
    const runs = await evaluationRunModel.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(10)
    res.status(200).json({ runs })
}

module.exports = {
    generateInterViewReportController,
    getInterviewReportByIdController,
    getAllInterviewReportsController,
    generateResumePdfController,
    deleteInterviewReportController,
    startSimulatorController,
    answerSimulatorController,
    finishSimulatorController,
    getSimulatorController,
    getSimulatorHistoryController,
    recalculateRoadmapController,
    runEvaluationSuiteController,
    getEvaluationSuiteController,
    getRagEvaluationController,
}

async function getRagEvaluationController(req, res) {
    const report = await interviewReportModel.findOne({ user: req.user.id }).sort({ createdAt: -1 })
    if (!report) return res.status(404).json({ message: "Generate an interview report before running the RAG evaluation." })
    res.status(200).json({ evaluation: evaluateRetrieval(report) })
}

async function getSimulatorHistoryController(req, res) {
    const page = Math.max(Number(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50)
    const query = { user: req.user.id }
    if (req.query.status === "active" || req.query.status === "completed") query.status = req.query.status
    if (req.query.reportId) {
        if (!mongoose.isValidObjectId(req.query.reportId)) return res.status(400).json({ message: "Invalid reportId." })
        query.report = req.query.reportId
    }
    const [sessions, total] = await Promise.all([
        interviewSessionModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select("-turns -skillProfile -finalReport"),
        interviewSessionModel.countDocuments(query),
    ])
    res.status(200).json({ sessions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
}

async function recalculateRoadmapController(req, res) {
    const session = await interviewSessionModel.findOne({ _id: req.params.sessionId, user: req.user.id }).populate("report")
    if (!session) return res.status(404).json({ message: "Interview session not found." })
    let updated
    try {
        updated = await generateUpdatedPreparationPlan({ report: session.report, skillProfile: session.skillProfile })
    } catch (error) {
        console.error("Roadmap recalculation failed:", error.message)
        return res.status(200).json({ preparationPlan: session.report.preparationPlan, message: "Roadmap kept unchanged because recalculation was unavailable." })
    }
    session.report.preparationPlan = updated.preparationPlan
    await session.report.save()
    res.status(200).json({ preparationPlan: updated.preparationPlan })
}