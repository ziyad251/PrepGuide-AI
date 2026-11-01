# Run Project

## Prerequisites

- Node.js 18+ (uses the built-in `fetch` and `node:test`)
- MongoDB (local or Atlas)
- Google Gemini API key

## Backend Setup

```bash
cd Backend
npm install
```

Create a `.env` file inside the `Backend` folder.

```env
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret_key
GOOGLE_GENAI_API_KEY=your_gemini_api_key

# Optional
GEMINI_MODEL=gemini-3-flash-preview   # default model for structured generation
OPENROUTER_API_KEY=                   # if set, OpenRouter is tried first and Gemini is the fallback
OPENROUTER_MODEL=
CLIENT_URL=                           # extra allowed CORS origin (5173/5174 are always allowed)
```

RAG uses the existing MongoDB instance for candidate knowledge documents.
Gemini embeddings are used when `GOOGLE_GENAI_API_KEY` is available; the
simulator falls back to lexical retrieval when embeddings are unavailable.

Start the backend:

```bash
npm run dev
```

Backend runs on:

```
http://localhost:3000
```

---

## Frontend Setup

```bash
cd Frontend
npm install
npm run dev
```

Optionally create `Frontend/.env` with `VITE_API_URL=http://localhost:3000` (this is the default).

Frontend runs on:

```
http://localhost:5173
```

---

## Steps

1. Start MongoDB.
2. Start the backend.
3. Start the frontend.
4. Open `http://localhost:5173` in your browser.
5. Register or log in, then create an interview plan (**New plan**) with your resume PDF and a job description.

---

## Trying the AI Mock Interview

1. Open **Practice → Mock interview** (or **Practice this role** on a plan).
2. Pick the plan, then choose **Technical**, **HR**, **Behavioural**, or **Mixed**, a starting difficulty, and a length.
3. Answer one question at a time (`Ctrl + Enter` submits). After each answer you get scored feedback, and the next question is either a contextual follow-up or a new topic.
4. Your draft is saved in the browser per question, so a refresh does not lose it. **Save & exit** keeps the session; the setup page offers **Resume interview**.
5. Click **Finish interview** at any time (or **Generate my report** after the last question) to get the final report: overall score out of 100, dimension scores, strengths, weaknesses, improvements, ideal answers, and topics to revise.
6. All sessions are listed under **Interview history**.

## Trying the Project Deep-Dive

1. Open **Practice → Project deep-dive**.
2. Select the plan whose resume you want to use. Projects are extracted once and cached; use **Re-scan resume** to refresh them, or **Describe a project manually** if none are found.
3. Pick focus areas (architecture, technology choices, database, API, auth and security, performance, scalability, error handling, real-world scenarios), difficulty, and length.
4. Answer the interviewer's questions. Weak answers get up to two follow-ups before the interview moves to the next focus area; the sidebar shows coverage and per-area scores.
5. Finish to get the project preparation report: understanding and technical knowledge scores, a category breakdown, weak areas, and the important questions to prepare, each with a suggested answer.

## When the AI provider is unavailable

The app keeps working with reduced intelligence:

- **Questions:** fall back to grounded template questions.
- **Answers:** are saved and marked as not scored, rather than given fake scores.
- **Reports:** are built from per-answer feedback, with a **Regenerate full report** button to retry once the provider is back.
- **Project extraction:** shows an error with a retry, plus the manual project option.

---

## Tests

```bash
cd Backend
npm test
```

The suite uses `node:test` and needs no database or API keys. Models and LLM providers are stubbed. It covers:

- **Scoring:** the deterministic score aggregation.
- **Interview types:** HR, behavioural, and mixed question handling.
- **Deep-dive logic:** category selection, follow-up caps, and template questions.
- **HTTP behaviour:**
  - authentication (401)
  - user scoping (404 for other users' sessions)
  - validation (400)
  - double-submit protection (409)
  - answer rollback on failure
  - question limits
  - fallback reports when the AI provider is down

```bash
cd Frontend
npm run build
npm run lint
```

## RAG showcase

Start an interview from a report, then expand **Why was this question
generated?** under the current question. The panel shows only the retrieved
candidate, project, and job evidence with relevance scores. The authenticated
endpoint `GET /api/interview/rag/evaluation` returns retrieval test cases and a
simple relevance-rate metric for the latest report.
