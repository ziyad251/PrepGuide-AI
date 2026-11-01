/**
 * Turn-level persistence helpers shared by the mock interview and project deep-dive sessions.
 */

/**
 * Atomically record an answer on an unanswered turn. Returns false when the turn was
 * already answered (double submit, second tab), so the same question is never evaluated twice.
 */
async function claimTurnAnswer(model, { sessionId, userId, turnIndex, answer }) {
    const result = await model.updateOne(
        { _id: sessionId, user: userId, status: "active", [`turns.${turnIndex}.answer`]: { $exists: false } },
        { $set: { [`turns.${turnIndex}.answer`]: answer, [`turns.${turnIndex}.answeredAt`]: new Date() } },
    )
    return result.modifiedCount > 0
}

/** Undo a claim after a processing failure so the candidate can resubmit instead of being stuck. */
async function releaseTurnAnswer(model, { sessionId, userId, turnIndex }) {
    try {
        await model.updateOne(
            { _id: sessionId, user: userId },
            { $unset: { [`turns.${turnIndex}.answer`]: "", [`turns.${turnIndex}.answeredAt`]: "" } },
        )
    } catch (error) {
        console.error("[SESSION] answer rollback failed", { sessionId: String(sessionId), message: error.message })
    }
}

module.exports = { claimTurnAnswer, releaseTurnAnswer }
