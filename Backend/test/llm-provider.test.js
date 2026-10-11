const test = require("node:test")
const assert = require("node:assert/strict")
const { z } = require("zod")
const {
    generateStructured,
    setRequestOverridesForTests,
} = require("../src/services/llm.service")

const schema = z.object({ question: z.string() })
const valid = JSON.stringify({ question: "How did you validate this API?" })

test.afterEach(() => {
    delete process.env.OPENROUTER_API_KEY
    setRequestOverridesForTests()
})

test("uses OpenRouter success without calling Gemini", async () => {
    process.env.OPENROUTER_API_KEY = "test-key"
    let geminiCalled = false
    let receivedPrompt
    setRequestOverridesForTests({
        openrouter: async ({ prompt }) => {
            receivedPrompt = prompt
            return valid
        },
        gemini: async () => {
            geminiCalled = true
            return valid
        },
    })

    assert.deepEqual(await generateStructured({ prompt: "RAG evidence: PrepGuide Node.js project", schema }), { question: "How did you validate this API?" })
    assert.equal(geminiCalled, false)
    assert.match(receivedPrompt, /RAG evidence: PrepGuide Node\.js project/)
})

for (const status of [429, 503]) {
    test(`falls back to Gemini for OpenRouter ${status}`, async () => {
        process.env.OPENROUTER_API_KEY = "test-key"
        let geminiCalled = false
        setRequestOverridesForTests({
            openrouter: async () => {
                const error = new Error("temporary provider failure")
                error.status = status
                throw error
            },
            gemini: async () => {
                geminiCalled = true
                return valid
            },
        })

        await generateStructured({ prompt: "RAG evidence", schema })
        assert.equal(geminiCalled, true)
    })
}

test("does not treat malformed provider output as a provider outage", async () => {
    process.env.OPENROUTER_API_KEY = "test-key"
    setRequestOverridesForTests({ openrouter: async () => JSON.stringify({ wrong: true }) })

    await assert.rejects(
        generateStructured({ prompt: "RAG evidence", schema }),
        (error) => error.code === "AI_SCHEMA_VALIDATION_FAILED" && error.provider === "openrouter",
    )
})

test("parses fenced JSON without issuing a retry", async () => {
    process.env.OPENROUTER_API_KEY = "test-key"
    let calls = 0
    setRequestOverridesForTests({
        openrouter: async () => {
            calls += 1
            return "Here is the result:\n```json\n" + valid + "\n```\n"
        },
    })

    assert.deepEqual(await generateStructured({ prompt: "RAG evidence", schema }), { question: "How did you validate this API?" })
    assert.equal(calls, 1)
})
