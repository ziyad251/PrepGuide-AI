const mongoose = require("mongoose")


/**
 * @description Validate req.body against a zod schema and replace it with the parsed value.
 */
function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body || {})
        if (!result.success) {
            const issue = result.error.issues[0]
            const field = issue.path.join(".")
            return res.status(400).json({ message: field ? `${field}: ${issue.message}` : issue.message })
        }
        req.body = result.data
        next()
    }
}


/**
 * @description Reject route params that are not valid MongoDB ObjectIds before they reach a query.
 */
function validateObjectIds(...params) {
    return (req, res, next) => {
        const invalid = params.find((param) => !mongoose.isValidObjectId(req.params[param]))
        if (invalid) return res.status(400).json({ message: `Invalid ${invalid}.` })
        next()
    }
}


module.exports = { validateBody, validateObjectIds }
