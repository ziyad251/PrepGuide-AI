import { scoreTone } from "../utils/format"

const RADIUS = 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Circular 0-100 score. Renders a dash when the score is unavailable. */
const ScoreRing = ({ score, label, size = "lg" }) => {
    const hasScore = typeof score === "number"
    const offset = CIRCUMFERENCE * (1 - (hasScore ? score : 0) / 100)
    return (
        <div className={`score-ring score-ring--${size} tone-${scoreTone(score)}`} role="img" aria-label={`${label || "Score"}: ${hasScore ? `${score} out of 100` : "not available"}`}>
            <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle className="score-ring__track" cx="50" cy="50" r={RADIUS} />
                {hasScore && <circle className="score-ring__value" cx="50" cy="50" r={RADIUS} strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset} />}
            </svg>
            <div className="score-ring__label">
                <strong>{hasScore ? score : "—"}</strong>
                {hasScore && <small>/100</small>}
            </div>
            {label && <span className="score-ring__caption">{label}</span>}
        </div>
    )
}

export default ScoreRing
