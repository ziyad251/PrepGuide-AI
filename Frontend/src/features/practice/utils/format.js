export const VERDICTS = {
    ready: { label: "Interview ready", tone: "success", hint: "You can walk into this interview with confidence." },
    almost_ready: { label: "Almost ready", tone: "primary", hint: "A focused round of revision will close the remaining gaps." },
    needs_practice: { label: "Needs practice", tone: "warning", hint: "Work through the topics below, then run another session." },
    insufficient_data: { label: "Not enough evidence", tone: "quiet", hint: "Answer more questions to get a reliable score." },
}

export const scoreTone = (score) => {
    if (typeof score !== "number") return "quiet"
    if (score >= 80) return "success"
    if (score >= 60) return "primary"
    if (score >= 40) return "warning"
    return "error"
}

export const INTERVIEW_TYPES = {
    technical: { label: "Technical", description: "Engineering fundamentals, implementation depth, debugging, and trade-offs." },
    hr: { label: "HR", description: "Motivation, career goals, culture fit, and how you work with others." },
    behavioral: { label: "Behavioural", description: "STAR-style questions about real situations: conflict, ownership, failure." },
    mixed: { label: "Mixed", description: "Alternates technical depth with behavioural questions, like a real loop." },
}

export const DIFFICULTIES = ["easy", "medium", "hard"]

export const SESSION_LENGTHS = [
    { value: 5, label: "Quick", hint: "5 questions · ~15 min" },
    { value: 8, label: "Standard", hint: "8 questions · ~25 min" },
    { value: 12, label: "Deep", hint: "12 questions · ~40 min" },
]

export const errorMessage = (error, fallback) => error?.response?.data?.message || fallback

export const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : ""

export const capitalize = (value) => String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1)
