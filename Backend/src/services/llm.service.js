const { GoogleGenAI } = require("@google/genai")
const { zodToJsonSchema } = require("zod-to-json-schema")

const AI_TIMEOUT_MS = 15000
const OPENROUTER_BODY_TIMEOUT_MS = 8000
let geminiClient
let requestOverrides = {}

class LlmError extends Error {
    constructor(code, message, provider, status) {
        super(message)
        this.name = code
        this.code = code
        this.provider = provider
        this.status = status
    }
}

function withTimeout(promise, label) {
    let timeoutId
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new LlmError("AI_TIMEOUT", `${label} timed out after ${AI_TIMEOUT_MS}ms`)), AI_TIMEOUT_MS)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

function withBodyTimeout(promise, label) {
    let timeoutId
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new LlmError("AI_TIMEOUT", `${label} timed out after ${OPENROUTER_BODY_TIMEOUT_MS}ms`)), OPENROUTER_BODY_TIMEOUT_MS)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

function getGeminiClient() {
    if (!process.env.GOOGLE_GENAI_API_KEY) throw new LlmError("AI_PROVIDER_UNAVAILABLE", "GOOGLE_GENAI_API_KEY is not set", "gemini")
    if (!geminiClient) geminiClient = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY })
    return geminiClient
}

function providerError(error, provider) {
    const status = Number(error?.status || error?.code || error?.response?.status)
    if (status === 429) return new LlmError("AI_QUOTA_EXCEEDED", error.message, provider, status)
    if ([500, 502, 503, 504].includes(status) || ["ECONNRESET", "ENOTFOUND", "ECONNREFUSED"].includes(error?.code)) {
        return new LlmError("AI_PROVIDER_UNAVAILABLE", error.message, provider, status)
    }
    if (error?.name === "AI_TIMEOUT" || error?.code === "ETIMEDOUT") {
        return new LlmError("AI_TIMEOUT", error.message, provider, status)
    }
    return new LlmError("AI_UNKNOWN_ERROR", error.message, provider, status)
}

async function requestOpenRouter({ prompt, schema, operation = "structured" }) {
    const startedAt = Date.now()
    try {
        const configuredModel = process.env.OPENROUTER_MODEL
        const model = configuredModel && configuredModel !== "openrouter/free"
            ? configuredModel
            : "google/gemma-4-26b-a4b-it:free"
        console.log("[PERF] Q1_PROVIDER_CALL_BEGIN", { provider: "openrouter", operation })
        const response = await withTimeout(fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + process.env.OPENROUTER_API_KEY,
                "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:5173",
                "X-Title": "PrepGuide AI",
            },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content: prompt }],
                response_format: {
                    type: "json_object",
                },
            }),
        }), "OpenRouter request")
        console.log("[LLM] OPENROUTER_RESPONSE", {
            status: response.status,
            elapsedMs: Date.now() - startedAt,
            model,
        })
        const bodyStartedAt = Date.now()
        console.log("[PERF] OPENROUTER_BODY_READ_BEGIN", { operation })
        const text = await withBodyTimeout(response.text(), "OpenRouter response body")
        console.log("[PERF] OPENROUTER_BODY_READ_END", { operation, elapsedMs: Date.now() - bodyStartedAt, contentLength: text.length })
        if (!response.ok) {
            const error = new Error(text || `OpenRouter HTTP ${response.status}`)
            error.status = response.status
            throw error
        }
        const envelopeStartedAt = Date.now()
        console.log("[PERF] OPENROUTER_ENVELOPE_PARSE_BEGIN", { operation })
        let body
        try {
            body = JSON.parse(text)
        } catch {
            console.log("[PERF] OPENROUTER_ENVELOPE_PARSE_END", { operation, elapsedMs: Date.now() - envelopeStartedAt, passed: false })
            throw new LlmError("AI_SCHEMA_VALIDATION_FAILED", "OpenRouter returned non-JSON output", "openrouter", response.status)
        }
        console.log("[PERF] OPENROUTER_ENVELOPE_PARSE_END", { operation, elapsedMs: Date.now() - envelopeStartedAt, passed: true })
        const contentStartedAt = Date.now()
        console.log("[PERF] OPENROUTER_CONTENT_EXTRACT_BEGIN", { operation })
        const content = normalizeAssistantContent(body.choices?.[0]?.message?.content)
        if (!content) {
            console.log("[PERF] OPENROUTER_CONTENT_EXTRACT_END", { operation, elapsedMs: Date.now() - contentStartedAt, passed: false })
            throw new LlmError("AI_SCHEMA_VALIDATION_FAILED", "OpenRouter response did not contain message content", "openrouter", response.status)
        }
        console.log("[PERF] OPENROUTER_CONTENT_EXTRACT_END", {
            operation,
            elapsedMs: Date.now() - contentStartedAt,
            passed: true,
            contentLength: String(content).length,
        })
        console.log("[PERF] Q1_PROVIDER_CALL_END", { provider: "openrouter", operation, elapsedMs: Date.now() - startedAt, status: response.status })
        return content
    } catch (error) {
        console.error("[LLM] OPENROUTER_ERROR", {
            type: error?.name || error?.constructor?.name || "Error",
            message: error?.message || String(error),
            elapsedMs: Date.now() - startedAt,
        })
        throw error
    }
}

async function requestGemini({ prompt, schema, operation = "structured" }) {
    const startedAt = Date.now()
    console.log("[PERF] Q1_PROVIDER_CALL_BEGIN", { provider: "gemini", operation })
    const response = await withTimeout(getGeminiClient().models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: zodToJsonSchema(schema) },
    }), "Gemini request")
    console.log("[PERF] Q1_PROVIDER_CALL_END", { provider: "gemini", operation, elapsedMs: Date.now() - startedAt })
    return response.text
}

async function requestProvider(provider, args) {
    try {
        if (requestOverrides[provider]) return await requestOverrides[provider](args)
        return await (provider === "openrouter" ? requestOpenRouter(args) : requestGemini(args))
    } catch (error) {
        if (error instanceof LlmError) throw error
        throw providerError(error, provider)
    }
}

function parseStructuredContent(content) {
    const text = String(content || "").trim()
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/gi)
    if (fenced?.length === 1) return fenced[0].replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
    return text
}

function normalizeAssistantContent(content) {
    if (typeof content === "string") return content
    if (Array.isArray(content)) {
        const textParts = content
            .map((part) => typeof part === "string" ? part : part?.text)
            .filter((part) => typeof part === "string")
        if (textParts.length) return textParts.join("")
    }
    return ""
}

function validate(content, schema, provider, operation = "structured") {
    const startedAt = Date.now()
    console.log("[PERF] Q1_PARSE_BEGIN", { provider, operation })
    const normalized = parseStructuredContent(content)
    const diagnostic = {
        operation,
        contentLength: String(content || "").length,
        startsWith: String(content || "").trim().slice(0, 20),
        endsWith: String(content || "").trim().slice(-20),
        looksLikeJson: /^\s*[{[]/.test(normalized),
        hasMarkdownFence: /^```/.test(String(content || "").trim()),
    }
    let parsed
    try {
        parsed = JSON.parse(normalized)
    } catch (error) {
        console.log("[LLM] STRUCTURED_OUTPUT_DIAGNOSTIC", { ...diagnostic, parseError: error.message })
        console.log("[PERF] Q1_PARSE_END", { provider, operation, elapsedMs: Date.now() - startedAt, passed: false, reason: "invalid_json" })
        throw new LlmError("AI_SCHEMA_VALIDATION_FAILED", `${provider} returned invalid JSON`, provider)
    }
    console.log("[LLM] STRUCTURED_OUTPUT_DIAGNOSTIC", { ...diagnostic, parseError: null })
    const result = schema.safeParse(parsed)
    if (!result.success) {
        console.log("[PERF] Q1_PARSE_END", { provider, operation, elapsedMs: Date.now() - startedAt, passed: false, reason: "schema_validation" })
        throw new LlmError("AI_SCHEMA_VALIDATION_FAILED", result.error.message, provider)
    }
    console.log("[PERF] Q1_PARSE_END", { provider, operation, elapsedMs: Date.now() - startedAt, passed: true })
    return result.data
}

async function generateStructured({ prompt, schema, operation = "structured" }) {
    const startedAt = Date.now()
    console.log("[PERF] Q1_GENERATION_BEGIN", { operation })
    if (process.env.OPENROUTER_API_KEY) {
        console.log("[LLM] primary=openrouter")
        try {
            const result = validate(await requestProvider("openrouter", { prompt, schema, operation }), schema, "openrouter", operation)
            console.log("[PERF] Q1_GENERATION_END", { operation, elapsedMs: Date.now() - startedAt, provider: "openrouter", passed: true })
            return result
        } catch (error) {
            const normalized = error instanceof LlmError ? error : providerError(error, "openrouter")
            if (!["AI_PROVIDER_UNAVAILABLE", "AI_QUOTA_EXCEEDED", "AI_TIMEOUT"].includes(normalized.code)) {
                console.log("[PERF] Q1_GENERATION_END", { operation, elapsedMs: Date.now() - startedAt, provider: "openrouter", passed: false, reason: normalized.code })
                throw normalized
            }
            console.error("[OPENROUTER] provider_error", { status: normalized.status || normalized.code })
            console.log("[LLM] GEMINI_FALLBACK_START")
            console.log("[LLM] fallback=gemini")
        }
    } else {
        console.log("[LLM] primary=openrouter unavailable; fallback=gemini")
    }

    try {
        const result = validate(await requestProvider("gemini", { prompt, schema, operation }), schema, "gemini", operation)
        console.log("[PERF] Q1_GENERATION_END", { operation, elapsedMs: Date.now() - startedAt, provider: "gemini", passed: true })
        return result
    } catch (error) {
        console.log("[PERF] Q1_GENERATION_END", { operation, elapsedMs: Date.now() - startedAt, provider: "gemini", passed: false, reason: error.code || error.name })
        throw error
    }
}

function setRequestOverridesForTests(overrides) {
    requestOverrides = overrides || {}
}

module.exports = { generateStructured, LlmError, withTimeout, providerError, setRequestOverridesForTests }
