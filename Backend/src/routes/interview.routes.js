const express = require("express")
const mongoose = require("mongoose")
const { z } = require("zod")
const authMiddleware = require("../middlewares/auth.middleware")
const { validateBody, validateObjectIds } = require("../middlewares/validate.middleware")
const interviewController = require("../controllers/interview.controller")
const upload = require("../middlewares/file.middleware")

const interviewRouter = express.Router()

function receiveResume(req, res, next) {
    upload.single("resume")(req, res, (error) => {
        if (error) {
            console.error("[UPLOAD] multipart parsing failed", { name: error.name, code: error.code, message: error.message })
            return res.status(400).json({ message: error.message })
        }
        next()
    })
}


/**
 * @route POST /api/interview/
 * @description generate new interview report on the basis of user self description,resume pdf and job description.
 * @access private
 */
interviewRouter.post("/", authMiddleware.authUser, receiveResume, interviewController.generateInterViewReportController)

/**
 * @route GET /api/interview/report/:interviewId
 * @description get interview report by interviewId.
 * @access private
 */
interviewRouter.get("/report/:interviewId", authMiddleware.authUser, interviewController.getInterviewReportByIdController)


/**
 * @route GET /api/interview/
 * @description get all interview reports of logged in user.
 * @access private
 */
interviewRouter.get("/", authMiddleware.authUser, interviewController.getAllInterviewReportsController)


/**
 * @route GET /api/interview/resume/pdf
 * @description generate resume pdf on the basis of user self description, resume content and job description.
 * @access private
 */
interviewRouter.post("/resume/pdf/:interviewReportId", authMiddleware.authUser, interviewController.generateResumePdfController)

/**
 * @route DELETE /api/interview/:interviewId
 * @description delete interview report by id for the logged-in user
 * @access private
 */
interviewRouter.delete("/:interviewId", authMiddleware.authUser, interviewController.deleteInterviewReportController)

const objectIdString = z.string().refine((value) => mongoose.isValidObjectId(value), "must be a valid id")

const startSimulatorSchema = z.object({
    reportId: objectIdString.optional(),
    targetRole: z.string().trim().max(120).optional(),
    interviewType: z.enum([ "technical", "hr", "behavioral", "mixed" ]).default("technical"),
    difficulty: z.enum([ "easy", "medium", "hard" ]).default("medium"),
    questionLimit: z.coerce.number().int().min(3).max(15).default(8),
    resume: z.string().max(20000).optional(),
    selfDescription: z.string().max(5000).optional(),
    jobDescription: z.string().max(10000).optional(),
})

const answerSchema = z.object({
    answer: z.string().trim().min(1, "Answer is required.").max(6000, "Keep answers under 6000 characters."),
})

const finishSchema = z.object({
    regenerate: z.boolean().optional(),
})

/**
 * @route POST /api/interview/simulator
 * @description start a mock interview (technical, hr, behavioral or mixed) grounded in an interview report.
 * @access private
 */
interviewRouter.post("/simulator", authMiddleware.authUser, validateBody(startSimulatorSchema), interviewController.startSimulatorController)

/**
 * @route GET /api/interview/simulator
 * @description paginated mock interview history for the logged in user. Optional filters: status, reportId.
 * @access private
 */
interviewRouter.get("/simulator", authMiddleware.authUser, interviewController.getSimulatorHistoryController)
interviewRouter.get("/simulator/:sessionId", authMiddleware.authUser, validateObjectIds("sessionId"), interviewController.getSimulatorController)
interviewRouter.post("/simulator/:sessionId/answer", authMiddleware.authUser, validateObjectIds("sessionId"), validateBody(answerSchema), interviewController.answerSimulatorController)

/**
 * @route POST /api/interview/simulator/:sessionId/finish
 * @description finish the interview and generate the final report. Pass { regenerate: true } to retry a fallback report.
 * @access private
 */
interviewRouter.post("/simulator/:sessionId/finish", authMiddleware.authUser, validateObjectIds("sessionId"), validateBody(finishSchema), interviewController.finishSimulatorController)
interviewRouter.post("/simulator/:sessionId/roadmap/recalculate", authMiddleware.authUser, validateObjectIds("sessionId"), interviewController.recalculateRoadmapController)
interviewRouter.post("/evaluation-suite/run", authMiddleware.authUser, interviewController.runEvaluationSuiteController)
interviewRouter.get("/evaluation-suite", authMiddleware.authUser, interviewController.getEvaluationSuiteController)
interviewRouter.get("/rag/evaluation", authMiddleware.authUser, interviewController.getRagEvaluationController)

module.exports = interviewRouter