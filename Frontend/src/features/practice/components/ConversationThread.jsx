import { useState } from "react"
import { scoreTone } from "../utils/format"

const FeedbackBlock = ({ feedback }) => {
    if (!feedback) return <p className="thread-turn__pending">Feedback pending.</p>
    if (feedback.degraded) return <p className="thread-turn__degraded">{feedback.text}</p>
    return (
        <div className="thread-feedback">
            <div className="thread-feedback__heading">
                <span className="eyebrow">Interviewer feedback</span>
                <strong className={`tone-text-${scoreTone(feedback.score * 10)}`}>{feedback.score}<small>/10</small></strong>
            </div>
            <p>{feedback.text}</p>
            {feedback.scores?.length > 0 && <dl className="thread-feedback__scores">{feedback.scores.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}/10</dd></div>)}</dl>}
            {feedback.strengths?.length > 0 && <ul className="thread-feedback__list thread-feedback__list--good">{feedback.strengths.map((item) => <li key={item}>{item}</li>)}</ul>}
            {feedback.gaps?.length > 0 && <ul className="thread-feedback__list thread-feedback__list--gap">{feedback.gaps.map((item) => <li key={item}>{item}</li>)}</ul>}
            {feedback.extra}
        </div>
    )
}

const ThreadTurn = ({ turn, number, tags, feedback, defaultOpen }) => {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <li className={`thread-turn ${open ? "is-open" : ""}`}>
            <button type="button" className="thread-turn__summary" onClick={() => setOpen(!open)} aria-expanded={open}>
                <span className="thread-turn__number">Q{number}</span>
                <span className="thread-turn__question">{turn.question}</span>
                {feedback && !feedback.degraded && <span className={`thread-turn__score tone-${scoreTone(feedback.score * 10)}`}>{feedback.score}/10</span>}
                <b aria-hidden="true">{open ? "−" : "+"}</b>
            </button>
            {open && (
                <div className="thread-turn__body">
                    {tags.length > 0 && <div className="chip-row">{tags.map((tag) => <span className="chip" key={tag}>{tag}</span>)}</div>}
                    <div className="thread-turn__answer">
                        <span>Your answer</span>
                        <p>{turn.answer}</p>
                    </div>
                    <FeedbackBlock feedback={feedback} />
                </div>
            )}
        </li>
    )
}

/**
 * Interview transcript. The most recent answered turn opens by default so the candidate
 * sees feedback on the answer they just gave.
 */
const ConversationThread = ({ turns, getTags = () => [], getFeedback, title = "Conversation so far", openLatest = true }) => {
    const answered = turns.map((turn, index) => ({ turn, number: index + 1 })).filter(({ turn }) => turn.answer)
    if (!answered.length) return null
    return (
        <section className="conversation-thread" aria-label={title}>
            <div className="conversation-thread__heading"><p className="eyebrow">{title}</p><span>{answered.length} answered</span></div>
            <ol>
                {answered.map(({ turn, number }, index) => (
                    <ThreadTurn key={turn._id || number} turn={turn} number={number} tags={getTags(turn)} feedback={getFeedback(turn)} defaultOpen={openLatest && index === answered.length - 1} />
                ))}
            </ol>
        </section>
    )
}

export default ConversationThread
