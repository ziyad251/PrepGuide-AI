/** Shown when the AI debrief was unavailable and a report was built from per-answer feedback only. */
const FallbackBanner = ({ onRegenerate, busy, error }) => (
    <div className="practice-banner practice-banner--warning" role="status">
        <span>{error || "This is a basic report built from your per-answer feedback because the detailed AI review was unavailable."}</span>
        <button type="button" className="button secondary-button" onClick={onRegenerate} disabled={busy}>{busy ? "Regenerating..." : "Regenerate full report"}</button>
    </div>
)

export default FallbackBanner
