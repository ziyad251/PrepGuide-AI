import { useEffect, useState } from "react"
import { Link, Navigate, useParams } from "react-router"
import { finishDeepDive, getDeepDive } from "../services/deepDive.api"
import { categoryLabel } from "../categories"
import ScoreRing from "../../practice/components/ScoreRing"
import ScoreBars from "../../practice/components/ScoreBars"
import InsightList from "../../practice/components/InsightList"
import ExpandableAnswer from "../../practice/components/ExpandableAnswer"
import ConversationThread from "../../practice/components/ConversationThread"
import FallbackBanner from "../../practice/components/FallbackBanner"
import { VERDICTS, capitalize, errorMessage, formatDate } from "../../practice/utils/format"
import "../../../style/product.scss"
import "../../practice/style/practice.scss"

const transcriptFeedback = (turn) => turn.evaluation && (turn.evaluation.degraded
    ? { degraded: true, text: turn.evaluation.feedback }
    : { score: turn.evaluation.overall, text: turn.evaluation.feedback, strengths: turn.evaluation.strengths, gaps: turn.evaluation.knowledgeGaps })

/**
 * @description Project preparation report for a completed deep-dive (/deep-dive/:sessionId/report).
 */
const DeepDiveReport = () => {
    const { sessionId } = useParams()
    const [session, setSession] = useState(null)
    const [error, setError] = useState("")
    const [regenerating, setRegenerating] = useState(false)
    const [regenerateError, setRegenerateError] = useState("")

    useEffect(() => {
        getDeepDive(sessionId)
            .then((response) => setSession(response.session))
            .catch((requestError) => setError(errorMessage(requestError, "We couldn't load this report.")))
    }, [sessionId])

    if (error) return <main className="product-page"><div className="empty-state"><h2>Report unavailable</h2><p>{error}</p><Link to="/deep-dive" className="button primary-button">Back to deep-dives</Link></div></main>
    if (!session) return <main className="product-page loading-state"><p className="eyebrow">Project report</p><h1>Loading your report...</h1></main>
    if (session.status !== "completed" || !session.finalReport) return <Navigate to={`/deep-dive/${sessionId}`} replace />

    const report = session.finalReport
    const verdict = VERDICTS[report.verdict] || VERDICTS.insufficient_data

    const regenerate = async () => {
        setRegenerating(true)
        setRegenerateError("")
        try {
            const response = await finishDeepDive(sessionId, { regenerate: true })
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
            <Link to="/deep-dive" className="quiet-link">← Project deep-dives</Link>
            <section className={`surface report-hero tone-${verdict.tone}`}>
                <ScoreRing score={report.overallScore} label="Overall readiness" />
                <div>
                    <span className="report-hero__verdict">{verdict.label}</span>
                    <h1>{session.project.name}</h1>
                    <p className="report-hero__summary">{report.summary}</p>
                    <div className="report-hero__meta chip-row">
                        <span className="chip">Project deep-dive</span>
                        <span className="chip">{capitalize(session.difficulty)}</span>
                        <span className="chip">{report.answeredCount} answered</span>
                        <span className="chip">{formatDate(session.completedAt || session.updatedAt)}</span>
                    </div>
                </div>
            </section>

            {report.source === "fallback" && <FallbackBanner onRegenerate={regenerate} busy={regenerating} error={regenerateError} />}

            <div className="report-grid">
                <section className="surface report-panel">
                    <p className="eyebrow">How well you know it</p>
                    <h2>Project scores</h2>
                    <div className="dual-scores">
                        <ScoreRing size="sm" score={report.projectUnderstandingScore} label="Project understanding" />
                        <ScoreRing size="sm" score={report.technicalKnowledgeScore} label="Technical knowledge" />
                    </div>
                    <p className="muted report-panel__hint">{verdict.hint}</p>
                </section>
                <section className="surface report-panel">
                    <p className="eyebrow">By topic</p>
                    <h2>Category breakdown</h2>
                    {report.categoryBreakdown?.length
                        ? <ScoreBars items={report.categoryBreakdown.map((item) => ({ label: categoryLabel(item.category), score: item.score, hint: `${item.questions} question${item.questions === 1 ? "" : "s"}` }))} />
                        : <p className="muted">No categories could be scored.</p>}
                </section>
            </div>

            <div className="report-grid">
                <InsightList eyebrow="Solid ground" title="What you explained well" items={report.strengths} tone="good" empty="Strengths will appear once answers are evaluated." />
                <section className="surface report-panel">
                    <p className="eyebrow">Gaps in understanding</p>
                    <h2>Weak areas</h2>
                    {report.weakAreas?.length ? (
                        <div className="topic-list">
                            {report.weakAreas.map((area) => (
                                <div className="topic-item" key={area.area}>
                                    <span className={`priority priority--${area.severity}`}>{area.severity}</span>
                                    <div><strong>{area.area}</strong><p>{area.reason}</p></div>
                                </div>
                            ))}
                        </div>
                    ) : <p className="muted">No major weak areas identified.</p>}
                </section>
            </div>

            {report.importantQuestions?.length > 0 && (
                <section className="report-block">
                    <div className="report-block__heading"><div><p className="eyebrow">Prepare these</p><h2>Important questions & suggested answers</h2></div><span>Likely in a real interview</span></div>
                    <div className="answer-stack">
                        {report.importantQuestions.map((item, index) => (
                            <ExpandableAnswer key={item.question} index={index} question={item.question} tags={[categoryLabel(item.category)]} answer={item.suggestedAnswer} answerLabel="Suggested answer">
                                {item.whyItMatters && <div className="answer-context"><span>Why interviewers ask this</span><p>{item.whyItMatters}</p></div>}
                            </ExpandableAnswer>
                        ))}
                    </div>
                </section>
            )}

            <section className="report-block">
                <details>
                    <summary className="report-block__heading transcript-toggle"><div><p className="eyebrow">Full record</p><h2>Session transcript</h2></div><span>Show</span></summary>
                    <ConversationThread turns={session.turns} getFeedback={transcriptFeedback} getTags={(turn) => [categoryLabel(turn.category), turn.isFollowUp ? "Follow-up" : null].filter(Boolean)} title="Every question and answer" openLatest={false} />
                </details>
            </section>

            <div className="report-actions report-block">
                <Link to="/deep-dive" className="button primary-button">Start another deep-dive</Link>
                <Link to="/mock-interview" className="button secondary-button">Take a mock interview</Link>
            </div>
        </main>
    )
}

export default DeepDiveReport
