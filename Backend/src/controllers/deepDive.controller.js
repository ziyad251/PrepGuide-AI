const interviewReportModel = require("../models/interviewReport.model")
const deepDiveSessionModel = require("../models/deepDiveSession.model")
const { DEEP_DIVE_CATEGORIES } = require("../models/deepDiveSession.model")
const { extractProjects, slugify, generateOpeningQuestion, evaluateDeepDiveAnswer, generateDeepDiveReport } = require("../services/deepDive.service")
const { claimTurnAnswer, releaseTurnAnswer } = require("../services/sessionTurn.service")

const devDetail = (error) => process.env.NODE_ENV === "production" ? undefined : error.message


/**
 * @description List projects found in a report's resume. Extraction runs once and is cached on
 * the report; pass ?refresh=true to re-scan.
 */
async function getProjectsController(req, res) {
    const report = await interviewReportModel
        .findOne({ _id: req.params.reportId, user: req.user.id })
        .select("title resume selfDescription projects projectsExtractedAt")
        .lean()
    if (!report) return res.status(404).json({ message: "Interview report not found." })
    const refresh = req.query.refresh === "true"
    if (report.projectsExtractedAt && !refresh) {
        return res.status(200).json({ projects: report.projects || [], reportTitle: report.title, cached: true })
    }
    let projects
    try {
        projects = await extractProjects({ resume: report.resume, selfDescription: report.selfDescription })
    } catch (error) {
        console.error("[DEEP_DIVE] project extraction failed", { code: error.code || error.name })
        return res.status(502).json({
            message: "We couldn't read the projects from your resume right now. Try again, or add a project manually.",
            code: "AI_UNAVAILABLE",
            detail: devDetail(error),
        })
    }
    await interviewReportModel.updateOne(
        { _id: report._id, user: req.user.id },
        { $set: { projects, projectsExtractedAt: new Date() } },
    )
    res.status(200).json({ projects, reportTitle: report.title, cached: false })
}


/**
 * @description Start a deep-dive session for a resume project (or a manually described one).
 */
async function startDeepDiveController(req, res) {
    const { reportId, projectId, customProject, difficulty, focusAreas, questionLimit } = req.body
    const report = await interviewReportModel.findOne({ _id: reportId, user: req.user.id }).select("projects").lean()
    if (!report) return res.status(404).json({ message: "Interview report not found." })

    let project
    if (customProject) {
        project = {
            projectId: `custom-${slugify(customProject.name)}`,
            name: customProject.name,
            summary: customProject.description,
            technologies: customProject.technologies,
            highlights: [],
            custom: true,
        }
    } else {
        project = (report.projects || []).find((item) => item.projectId === projectId)
        if (!project) return res.status(404).json({ message: "Project not found. Refresh your project list and try again." })
    }

    const areas = focusAreas?.length ? DEEP_DIVE_CATEGORIES.filter((category) => focusAreas.includes(category)) : DEEP_DIVE_CATEGORIES
    try {
        const opening = await generateOpeningQuestion({ project, difficulty, focusAreas: areas })
        const session = await deepDiveSessionModel.create({
            user: req.user.id,
            report: report._id,
            project,
            difficulty,
            focusAreas: areas,
            questionLimit,
            turns: [ { question: opening.question, category: opening.category, difficulty } ],
        })
        res.status(201).json({ session })
    } catch (error) {
        console.error("[DEEP_DIVE] start failed", { name: error.name, message: error.message })
        res.status(502).json({ message: "Could not start the project deep-dive.", detail: devDetail(error) })
    }
}


/**
 * @description Paginated deep-dive history for the logged-in user (without transcripts).
 */
async function getDeepDiveHistoryController(req, res) {
    const page = Math.max(Number(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50)
    const query = { user: req.user.id }
    if (req.query.status === "active" || req.query.status === "completed") query.status = req.query.status
    const [ sessions, total ] = await Promise.all([
        deepDiveSessionModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select("-turns -finalReport -project.highlights").lean(),
        deepDiveSessionModel.countDocuments(query),
    ])
    res.status(200).json({ sessions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
}


async function getDeepDiveController(req, res) {
    const session = await deepDiveSessionModel.findOne({ _id: req.params.sessionId, user: req.user.id })
    if (!session) return res.status(404).json({ message: "Deep-dive session not found." })
    res.status(200).json({ session })
}


/**
 * @description Evaluate the answer to the current question and ask the next one.
 */
async function answerDeepDiveController(req, res) {
    const session = await deepDiveSessionModel.findOne({ _id: req.params.sessionId, user: req.user.id })
    if (!session) return res.status(404).json({ message: "Deep-dive session not found." })
    if (session.status === "completed") return res.status(400).json({ message: "This deep-dive is already complete." })
    const { answer } = req.body
    const turnIndex = session.turns.length - 1
    const currentTurn = session.turns[turnIndex]
    if (currentTurn.answer) return res.status(409).json({ message: "This question has already been answered. Finish the session to see your report." })
    const claimed = await claimTurnAnswer(deepDiveSessionModel, { sessionId: session._id, userId: req.user.id, turnIndex, answer })
    if (!claimed) return res.status(409).json({ message: "This answer is already being processed." })
    currentTurn.answer = answer
    currentTurn.answeredAt = new Date()
    try {
        const answeredCount = session.turns.filter((turn) => turn.answer).length
        const readyToFinish = answeredCount >= session.questionLimit
        const { evaluation, next } = await evaluateDeepDiveAnswer({ session, turn: currentTurn, answer, needsNextQuestion: !readyToFinish })
        currentTurn.evaluation = evaluation
        if (next) session.turns.push(next)
        await session.save()
        res.status(200).json({ session, evaluation, readyToFinish })
    } catch (error) {
        console.error("[DEEP_DIVE] answer failed", { name: error.name, message: error.message })
        await releaseTurnAnswer(deepDiveSessionModel, { sessionId: session._id, userId: req.user.id, turnIndex })
        res.status(502).json({ message: "We couldn't process your answer. Your draft is still here; please submit it again.", detail: devDetail(error) })
    }
}


/**
 * @description Finish the deep-dive and generate the project preparation report. Idempotent;
 * pass { regenerate: true } to retry a fallback report.
 */
async function finishDeepDiveController(req, res) {
    const session = await deepDiveSessionModel.findOne({ _id: req.params.sessionId, user: req.user.id })
    if (!session) return res.status(404).json({ message: "Deep-dive session not found." })
    if (session.finalReport?.source === "ai" || (session.finalReport && !req.body?.regenerate)) {
        return res.status(200).json({ session })
    }
    if (!session.turns.some((turn) => turn.answer)) {
        return res.status(400).json({ message: "Answer at least one question before finishing." })
    }
    if (!session.turns[session.turns.length - 1].answer) session.turns.pop()
    const finalReport = await generateDeepDiveReport({ session })
    session.finalReport = finalReport
    session.overallScore = finalReport.overallScore ?? undefined
    session.status = "completed"
    session.completedAt = session.completedAt || new Date()
    await session.save()
    res.status(200).json({ session })
}


async function deleteDeepDiveController(req, res) {
    const session = await deepDiveSessionModel.findOneAndDelete({ _id: req.params.sessionId, user: req.user.id })
    if (!session) return res.status(404).json({ message: "Deep-dive session not found." })
    res.status(200).json({ message: "Deep-dive session deleted." })
}


module.exports = {
    getProjectsController,
    startDeepDiveController,
    getDeepDiveHistoryController,
    getDeepDiveController,
    answerDeepDiveController,
    finishDeepDiveController,
    deleteDeepDiveController,
}
