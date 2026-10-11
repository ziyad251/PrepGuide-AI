const express = require("express")
const authMiddleware = require("../middlewares/auth.middleware")
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

interviewRouter.post("/simulator", authMiddleware.authUser, interviewController.startSimulatorController)
interviewRouter.get("/simulator", authMiddleware.authUser, interviewController.getSimulatorHistoryController)
interviewRouter.get("/simulator/:sessionId", authMiddleware.authUser, interviewController.getSimulatorController)
interviewRouter.post("/simulator/:sessionId/answer", authMiddleware.authUser, interviewController.answerSimulatorController)
interviewRouter.post("/simulator/:sessionId/roadmap/recalculate", authMiddleware.authUser, interviewController.recalculateRoadmapController)
interviewRouter.post("/evaluation-suite/run", authMiddleware.authUser, interviewController.runEvaluationSuiteController)
interviewRouter.get("/evaluation-suite", authMiddleware.authUser, interviewController.getEvaluationSuiteController)
interviewRouter.get("/rag/evaluation", authMiddleware.authUser, interviewController.getRagEvaluationController)

module.exports = interviewRouter