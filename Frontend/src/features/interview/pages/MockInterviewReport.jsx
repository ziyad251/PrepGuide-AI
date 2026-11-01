import { useEffect, useState } from "react"
import { Link, Navigate, useParams } from "react-router"
import { finishSimulator, getSimulator } from "../services/interview.api"
import ScoreRing from "../../practice/components/ScoreRing"
import ScoreBars from "../../practice/components/ScoreBars"
import InsightList from "../../practice/components/InsightList"
import ExpandableAnswer from "../../practice/components/ExpandableAnswer"
import ConversationThread from "../../practice/components/ConversationThread"
import FallbackBanner from "../../practice/components/FallbackBanner"
import { INTERVIEW_TYPES, VERDICTS, capitalize, errorMessage, formatDate } from "../../practice/utils/format"
import "../../../style/product.scss"
import "../../practice/style/practice.scss"

const DIMENSIONS = [
    ["technicalCorrectness", "Technical correctness", "Are your facts and reasoning right?"],
    ["communication", "Communication & clarity", "Is your answer organised and easy to follow?"],
    ["problemSolving", "Problem-solving", "Do you structure the problem and weigh trade-offs?"],
    ["relevance", "Relevance", "Do you answer the question that was asked?"],
]

const transcriptFeedback = (turn) => turn.evaluation && (turn.evaluation.degraded
    ? { degraded: true, text: turn.evaluation.feedback }
    : { score: turn.evaluation.overall, text: turn.evaluation.feedback, strengths: turn.evaluation.strengths, gaps: turn.evaluation.missingConcepts })

/**
 * @description Final report for a completed mock interview (/sessions/:sessionId/report).
 */
const MockInterviewReport = () => {
    const { sessionId } = useParams()
    const [session, setSession] = useState(null)
    const [error, setError] = useState("")
    const [regenerating, setRegenerating] = useState(false)
    const [regenerateError, setRegenerateError] = useState("")

    useEffect(() => {
        getSimulator(sessionId)
            .then((response) => setSession(response.session))
            .catch((requestError) => setError(errorMessage(requestError, "We couldn't load this report.")))
    }, [sessionId])

    if (error) return <main className="product-page"><div className="empty-state"><h2>Report unavailable</h2><p>{error}</p><Link to="/history" className="button primary-button">Back to history</Link></div></main>
    if (!session) return <main className="product-page loading-state"><p className="eyebrow">Interview report</p><h1>Loading your report...</h1></main>
    if (session.status !== "completed" || !session.finalReport) return <Navigate to={`/sessions/${sessionId}`} replace />

    const report = session.finalReport
    const verdict = VERDICTS[report.verdict] || VERDICTS.insufficient_data
    const typeLabel = INTERVIEW_TYPES[session.interviewType]?.label || session.interviewType

    const regenerate = async () => {
        setRegenerating(true)
        setRegenerateError("")
        try {
            const response = await finishSimulator(sessionId, { regenerate: true })
            setSession(response.session)
            if (response.session.finalReport?.source === "fallback") setRegenerateError("The AI service is still unavailable. Please try again in a minute.")
        } catch (requestError) {
            setRegenerateError(errorMessage(requestError, "Regeneration failed. Please try again."))
        } finally {
            setRegenerating(false)
        }
    }

    return (
        <main className="product-page">
            <Link to="/history" className="quiet-link">← Interview history</Link>
            <section className={`surface report-hero tone-${verdict.tone}`}>
                <ScoreRing score={report.overallScore} label="Overall score" />
                <div>
                    <span className="report-hero__verdict">{verdict.label}</span>
                    <h1>{session.targetRole}</h1>
                    <p className="report-hero__summary">{report.summary}</p>
                    <div className="report-hero__meta chip-row">
                        <span className="chip">{typeLabel} interview</span>
                        <span className="chip">{capitalize(session.difficulty)} start</span>
                        <span className="chip">{report.answeredCount} answered</span>
                        {report.evaluatedCount < report.answeredCount && <span className="chip">{report.answeredCount - report.evaluatedCount} not scored</span>}
                        <span className="chip">{formatDate(session.completedAt || session.updatedAt)}</span>
                    </div>
                </div>
            </section>

            {report.source === "fallback" && <FallbackBanner onRegenerate={regenerate} busy={regenerating} error={regenerateError} />}

            <div className="report-grid">
                <section className="surface report-panel">
                    <p className="eyebrow">Evaluation</p>
                    <h2>Score breakdown</h2>
                    <p className="muted">{verdict.hint}</p>
                    <ScoreBars items={DIMENSIONS.map(([key, label, hint]) => ({ label, hint, score: report.scores?.[key] }))} />
                </section>
                <section className="surface report-panel">
                    <p className="eyebrow">What to study next</p>
                    <h2>Topics to revise</h2>
                    {report.topicsToRevise?.length ? (
                        <div className="topic-list">
                            {report.topicsToRevise.map((topic) => (
                                <div className="topic-item" key={topic.topic}>
                                    <span className={`priority priority--${topic.priority}`}>{topic.priority}</span>
                                    <div><strong>{topic.topic}</strong><p>{topic.reason}</p></div>
                                </div>
                            ))}
                        </div>
                    ) : <p className="muted">No specific topics flagged.</p>}
                </section>
            </div>

            <div className="report-grid">
                <InsightList eyebrow="Keep doing" title="Strengths" items={report.strengths} tone="good" empty="Strengths will appear once answers are evaluated." />
                <InsightList eyebrow="Watch out" title="Weaknesses" items={report.weaknesses} tone="gap" empty="No clear weaknesses identified." />
            </div>
            <InsightList eyebrow="Next session" title="Suggested improvements" items={report.improvements} tone="action" />

            {report.idealAnswers?.length > 0 && (
                <section className="report-block">
                    <div className="report-block__heading"><div><p className="eyebrow">Learn from the ideal</p><h2>Ideal answer examples</h2></div><span>Open a question to compare</span></div>
                    <div className="answer-stack">
                        {report.idealAnswers.map((item, index) => (
                            <ExpandableAnswer key={item.question} index={index} question={item.question} tags={[typeof item.score === "number" ? `You scored ${item.score}/10` : null]} answer={item.idealAnswer} keyPoints={item.keyPoints}>
                                {item.answerSummary && <div className="answer-context"><span>What you said</span><p>{item.answerSummary}</p></div>}
                            </ExpandableAnswer>
                        ))}
                    </div>
                </section>
            )}

            <section className="report-block">
                <details>
                    <summary className="report-block__heading transcript-toggle"><div><p className="eyebrow">Full record</p><h2>Interview transcript</h2></div><span>Show</span></summary>
                    <ConversationThread turns={session.turns} getFeedback={transcriptFeedback} title="Every question and answer" openLatest={false} />
                </details>
            </section>

            <div className="report-actions report-block">
                <Link to={`/interview/${session.report}/simulator`} className="button primary-button">Practice again</Link>
                <Link to="/deep-dive" className="button secondary-button">Prepare a project deep-dive</Link>
                <Link to="/roadmap" className="button secondary-button">View roadmap</Link>
            </div>
        </main>
    )
}

export default MockInterviewReport
