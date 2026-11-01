import { useState } from "react"
import ThinkingIndicator from "./ThinkingIndicator"

const MAX_LENGTH = 6000

const readDraft = (key) => {
    try { return window.localStorage.getItem(key) || "" } catch { return "" }
}
const writeDraft = (key, value) => {
    try {
        if (value) window.localStorage.setItem(key, value)
        else window.localStorage.removeItem(key)
    } catch { /* storage unavailable (private mode); drafts are a convenience only */ }
}

/**
 * Answer editor with a per-question draft that survives refreshes, Ctrl/Cmd+Enter to submit,
 * and an evaluation progress state. onSubmit must throw on failure so the draft is kept.
 * Render with key={draftKey} so each question starts from its own draft.
 */
const AnswerComposer = ({ draftKey, onSubmit, busy, placeholder, evaluatingMessages }) => {
    const [answer, setAnswer] = useState(() => readDraft(draftKey))
    const [error, setError] = useState("")

    const update = (value) => { setAnswer(value); writeDraft(draftKey, value) }

    const submit = async (event) => {
        event?.preventDefault()
        const trimmed = answer.trim()
        if (!trimmed || busy) return
        setError("")
        try {
            await onSubmit(trimmed)
            writeDraft(draftKey, "")
            setAnswer("")
        } catch (requestError) {
            setError(requestError.message || "Your answer could not be submitted. Please try again.")
        }
    }

    const words = answer.trim() ? answer.trim().split(/\s+/).length : 0

    return (
        <form className="answer-composer" onSubmit={submit}>
            <label htmlFor="answer-composer">Your answer</label>
            <textarea
                id="answer-composer"
                value={answer}
                onChange={(event) => update(event.target.value)}
                onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") submit(event) }}
                placeholder={placeholder}
                rows="8"
                maxLength={MAX_LENGTH}
                disabled={busy}
            />
            <div className="answer-composer__footer">
                {busy
                    ? <ThinkingIndicator messages={evaluatingMessages} />
                    : <span className="answer-composer__hint">{words ? `${words} words · draft saved` : "Think aloud: reasoning, trade-offs, and concrete examples."}<kbd>Ctrl</kbd>+<kbd>Enter</kbd> to submit</span>}
                <button className="button primary-button" disabled={busy || !answer.trim()}>{busy ? "Evaluating..." : "Submit answer"}</button>
            </div>
            {words > 0 && words < 25 && !busy && <p className="answer-composer__nudge">Short answers score low. Add the why, a trade-off, or an example.</p>}
            {error && <p className="inline-error" role="alert">{error}</p>}
        </form>
    )
}

export default AnswerComposer
