import { scoreTone } from "../utils/format"

/** Labelled horizontal bars for 0-100 scores. items: [{ label, score, hint? }] */
const ScoreBars = ({ items }) => (
    <div className="score-bars">
        {items.map((item) => (
            <div className={`score-bars__row tone-${scoreTone(item.score)}`} key={item.label}>
                <div className="score-bars__top">
                    <span>{item.label}</span>
                    <strong>{typeof item.score === "number" ? item.score : "—"}</strong>
                </div>
                <span className="score-bars__track"><i style={{ width: `${item.score || 0}%` }} /></span>
                {item.hint && <small>{item.hint}</small>}
            </div>
        ))}
    </div>
)

export default ScoreBars
