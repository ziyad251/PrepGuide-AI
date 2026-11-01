import { useState } from "react"
import ReportMarkdown from "../../interview/components/ReportMarkdown"

/** Collapsible question card with a model answer, used for ideal answers and questions to prepare. */
const ExpandableAnswer = ({ index, question, tags = [], children, answer, answerLabel = "Ideal answer", keyPoints = [] }) => {
    const [open, setOpen] = useState(false)
    return (
        <article className={`surface expandable-answer ${open ? "is-open" : ""}`}>
            <button type="button" className="expandable-answer__toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
                <span className="expandable-answer__index">Q{String(index + 1).padStart(2, "0")}</span>
                <span className="expandable-answer__question">
                    <strong>{question}</strong>
                    {tags.length > 0 && <span className="expandable-answer__tags">{tags.filter(Boolean).map((tag) => <span key={tag}>{tag}</span>)}</span>}
                </span>
                <b aria-hidden="true">{open ? "−" : "+"}</b>
            </button>
            {open && (
                <div className="expandable-answer__body">
                    {children}
                    <div className="expandable-answer__ideal">
                        <span>{answerLabel}</span>
                        <ReportMarkdown content={answer} />
                    </div>
                    {keyPoints.length > 0 && (
                        <div className="expandable-answer__points">
                            <span>Key points to cover</span>
                            <ul>{keyPoints.map((point) => <li key={point}>{point}</li>)}</ul>
                        </div>
                    )}
                </div>
            )}
        </article>
    )
}

export default ExpandableAnswer
