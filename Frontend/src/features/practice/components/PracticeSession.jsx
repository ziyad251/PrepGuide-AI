import { useState } from "react"
import { Link } from "react-router"
import ConfirmModal from "../../../components/ConfirmModal"
import ConversationThread from "./ConversationThread"
import AnswerComposer from "./AnswerComposer"
import ThinkingIndicator from "./ThinkingIndicator"
import "../style/practice.scss"

const REPORT_MESSAGES = ["Reviewing your answers...", "Scoring each dimension...", "Writing ideal answers...", "Picking topics to revise...", "Almost there..."]

/**
 * Shared live-interview layout for the mock interview and project deep-dive.
 * The page owns data loading; this component owns the interview flow and UI.
 */
const PracticeSession = ({
    session,
    eyebrow,
    title,
    subtitle,
    exitTo,
    sidebar,
    questionTags = [],
    questionAside,
    getTurnTags,
    getFeedback,
    onSubmitAnswer,
    onFinish,
    evaluatingMessages,
    placeholder = "Explain your reasoning, the trade-offs you considered, and concrete examples.",
}) => {
    const [submitting, setSubmitting] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [finishing, setFinishing] = useState(false)
    const [finishError, setFinishError] = useState("")

    const currentTurn = session.turns[session.turns.length - 1]
    const answeredCount = session.turns.filter((turn) => turn.answer).length
    const awaitingFinish = Boolean(currentTurn?.answer)
    const questionNumber = Math.min(session.turns.length, session.questionLimit)
    const draftKey = `prepguide-draft-${session._id}-${currentTurn?._id || session.turns.length}`
    const progress = Math.min(100, Math.round((answeredCount / session.questionLimit) * 100))

    const submit = async (answer) => {
        setSubmitting(true)
        try { await onSubmitAnswer(answer) } finally { setSubmitting(false) }
    }

    const finish = async () => {
        setConfirmOpen(false)
        setFinishing(true)
        setFinishError("")
        try {
            await onFinish()
        } catch (error) {
            setFinishError(error.message)
            setFinishing(false)
        }
    }

    if (finishing) {
        return (
            <main className="product-page practice-generating">
                <div className="surface practice-generating__card">
                    <div className="generation-spinner" aria-hidden="true" />
                    <p className="eyebrow">Interview complete</p>
                    <h1>Preparing your report</h1>
                    <p className="muted">This usually takes 10 to 30 seconds.</p>
                    <ThinkingIndicator messages={REPORT_MESSAGES} interval={4500} />
                </div>
            </main>
        )
    }

    return (
        <main className="product-page practice-session">
            <header className="practice-session__header">
                <div>
                    <p className="eyebrow">{eyebrow}</p>
                    <h1>{title}</h1>
                    {subtitle && <p className="practice-session__subtitle">{subtitle}</p>}
                </div>
                <div className="practice-session__actions">
                    <Link to={exitTo} className="quiet-link">Save &amp; exit</Link>
                    <button type="button" className="button secondary-button" onClick={() => setConfirmOpen(true)} disabled={!answeredCount || submitting}>Finish interview</button>
                </div>
            </header>
            <div className="practice-progress" aria-label={`${answeredCount} of ${session.questionLimit} questions answered`}>
                <span className="practice-progress__track"><i style={{ width: `${progress}%` }} /></span>
                <span>{answeredCount}/{session.questionLimit} answered</span>
            </div>
            {finishError && <p className="practice-banner practice-banner--error" role="alert">{finishError}</p>}

            <div className="practice-session__grid">
                <section className="practice-session__main">
                    <ConversationThread turns={session.turns} getTags={getTurnTags} getFeedback={getFeedback} />

                    {awaitingFinish ? (
                        <div className="surface practice-complete">
                            <p className="eyebrow">All {session.questionLimit} questions answered</p>
                            <h2>Ready for your debrief</h2>
                            <p className="muted">Generate your report to see your scores, ideal answers, and what to revise next.</p>
                            <button type="button" className="button primary-button" onClick={finish}>Generate my report</button>
                        </div>
                    ) : (
                        <>
                            <article className="practice-question" aria-live="polite">
                                <div className="practice-question__meta">
                                    <span className="eyebrow">Question {questionNumber} of {session.questionLimit}</span>
                                    {currentTurn.isFollowUp && <span className="follow-up-badge">Follow-up</span>}
                                </div>
                                <h2>{currentTurn.question}</h2>
                                {questionTags.length > 0 && <div className="practice-question__tags">{questionTags.filter(Boolean).map((tag) => <span key={tag}>{tag}</span>)}</div>}
                            </article>
                            {questionAside}
                            <AnswerComposer
                                key={draftKey}
                                draftKey={draftKey}
                                onSubmit={submit}
                                busy={submitting}
                                placeholder={placeholder}
                                evaluatingMessages={evaluatingMessages}
                            />
                        </>
                    )}
                </section>
                {sidebar && <aside className="practice-session__side">{sidebar}</aside>}
            </div>

            <ConfirmModal
                open={confirmOpen}
                title="Finish this interview?"
                message={`You've answered ${answeredCount} of ${session.questionLimit} questions. Your report will be based on the answers so far; unanswered questions are skipped.`}
                confirmLabel="Finish & get report"
                cancelLabel="Keep going"
                onConfirm={finish}
                onCancel={() => setConfirmOpen(false)}
            />
        </main>
    )
}

export default PracticeSession
