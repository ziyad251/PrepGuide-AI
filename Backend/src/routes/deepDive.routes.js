const express = require("express")
const mongoose = require("mongoose")
const { z } = require("zod")
const authMiddleware = require("../middlewares/auth.middleware")
const { validateBody, validateObjectIds } = require("../middlewares/validate.middleware")
const deepDiveController = require("../controllers/deepDive.controller")
const { DEEP_DIVE_CATEGORIES } = require("../models/deepDiveSession.model")

const deepDiveRouter = express.Router()

const startDeepDiveSchema = z.object({
    reportId: z.string().refine((value) => mongoose.isValidObjectId(value), "must be a valid id"),
    projectId: z.string().trim().min(1).max(80).optional(),
    customProject: z.object({
        name: z.string().trim().min(2, "Project name is required.").max(120),
        description: z.string().trim().min(20, "Describe the project in at least 20 characters.").max(2000),
        technologies: z.array(z.string().trim().min(1).max(40)).max(15).default([]),
    }).optional(),
    difficulty: z.enum([ "easy", "medium", "hard" ]).default("medium"),
    focusAreas: z.array(z.enum(DEEP_DIVE_CATEGORIES)).max(DEEP_DIVE_CATEGORIES.length).optional(),
    questionLimit: z.coerce.number().int().min(3).max(15).default(8),
}).refine((body) => Boolean(body.projectId) !== Boolean(body.customProject), {
    message: "Provide either projectId or customProject.",
})

const answerSchema = z.object({
    answer: z.string().trim().min(1, "Answer is required.").max(6000, "Keep answers under 6000 characters."),
})

const finishSchema = z.object({
    regenerate: z.boolean().optional(),
})

deepDiveRouter.use(authMiddleware.authUser)

/**
 * @route GET /api/deep-dive/reports/:reportId/projects
 * @description list projects extracted from the report's resume (cached; ?refresh=true re-scans).
 * @access private
 */
deepDiveRouter.get("/reports/:reportId/projects", validateObjectIds("reportId"), deepDiveController.getProjectsController)

/**
 * @route POST /api/deep-dive
 * @description start a project deep-dive session.
 * @access private
 */
deepDiveRouter.post("/", validateBody(startDeepDiveSchema), deepDiveController.startDeepDiveController)

/**
 * @route GET /api/deep-dive
 * @description paginated deep-dive history of the logged in user.
 * @access private
 */
deepDiveRouter.get("/", deepDiveController.getDeepDiveHistoryController)

/**
 * @route GET /api/deep-dive/:sessionId
 * @description get a deep-dive session with its transcript and report.
 * @access private
 */
deepDiveRouter.get("/:sessionId", validateObjectIds("sessionId"), deepDiveController.getDeepDiveController)

/**
 * @route POST /api/deep-dive/:sessionId/answer
 * @description answer the current question; returns the evaluation and the next question.
 * @access private
 */
deepDiveRouter.post("/:sessionId/answer", validateObjectIds("sessionId"), validateBody(answerSchema), deepDiveController.answerDeepDiveController)

/**
 * @route POST /api/deep-dive/:sessionId/finish
 * @description finish the session and generate the project preparation report.
 * @access private
 */
deepDiveRouter.post("/:sessionId/finish", validateObjectIds("sessionId"), validateBody(finishSchema), deepDiveController.finishDeepDiveController)

/**
 * @route DELETE /api/deep-dive/:sessionId
 * @description delete a deep-dive session.
 * @access private
 */
deepDiveRouter.delete("/:sessionId", validateObjectIds("sessionId"), deepDiveController.deleteDeepDiveController)

module.exports = deepDiveRouter
