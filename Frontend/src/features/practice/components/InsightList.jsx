/** A titled list of report insights (strengths, weaknesses, improvements). */
const InsightList = ({ title, eyebrow, items = [], tone = "neutral", empty = "Nothing recorded." }) => (
    <section className={`surface insight-list insight-list--${tone}`}>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="muted">{empty}</p>}
    </section>
)

export default InsightList
