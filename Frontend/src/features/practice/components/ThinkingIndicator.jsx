import { useEffect, useState } from "react"

/** Cycles through status messages while a long AI request runs. */
const ThinkingIndicator = ({ messages, interval = 3500, className = "" }) => {
    const [index, setIndex] = useState(0)
    useEffect(() => {
        const timer = setInterval(() => setIndex((current) => Math.min(current + 1, messages.length - 1)), interval)
        return () => clearInterval(timer)
    }, [messages.length, interval])
    return (
        <div className={`thinking ${className}`} role="status" aria-live="polite">
            <span className="thinking__dots" aria-hidden="true"><i /><i /><i /></span>
            <span>{messages[index]}</span>
        </div>
    )
}

export default ThinkingIndicator
