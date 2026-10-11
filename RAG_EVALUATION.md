# RAG evaluation and failure evidence

## Evaluation cases

The backend exposes `GET /api/interview/rag/evaluation` for an authenticated
user. It evaluates project, backend-role, and irrelevant queries against the
latest report-derived chunks and returns the top actual source types, whether
the expected source was retrieved, and a simple relevance rate.

The endpoint is intentionally small and explainable rather than a
research-grade benchmark. Interview turns also store the retrieved chunks so
the UI and a demo can inspect the exact evidence used.

## Failure evidence

The first retrieval implementation queried every knowledge document owned by
the user. That was a real scoping bug: a new interview could retrieve chunks
from an older report, even when the wording was semantically similar. The fix
was to scope report-derived chunks by `metadata.reportId` and session evidence
by `metadata.sessionId`. A second guard is the shorter focus-oriented query
for later turns, instead of sending the full job description as the query.

The complete fix was to split report fields into typed `RESUME`, `PROJECT`,
`JOB_DESCRIPTION`, and `SKILL` chunks, scope retrieval to the active report
and session, preserve source type/title/metadata/score with each result, and
instruct Gemini to use evidence only when relevant. If evidence is
insufficient, the prompt explicitly requires a general question.

Question grounding now uses a source-aware context contract. Candidate
evidence is listed first, job requirements are listed separately, and
previous-answer evidence is explicitly marked for follow-up questions. When
candidate evidence exists, a deterministic overlap guard prevents a generic
LLM response from replacing the grounded fallback question.

This before/after is kept as showcase evidence: the failed setup-query
retrieval scoping bug is represented by the initial user-wide query behavior,
while turn-level retrieval demonstrates the corrected metadata-aware flow.
Run the endpoint against a real report before the showcase and keep its JSON
response as the actual retrieval evidence.
