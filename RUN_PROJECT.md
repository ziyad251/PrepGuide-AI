# Run Project

## Prerequisites

- Node.js
- MongoDB
- Google Gemini API Key

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
5. Register/Login and start using the application.

## RAG showcase

Start an interview from a report, then expand **Why was this question
generated?** under the current question. The panel shows only the retrieved
candidate, project, and job evidence with relevance scores. The authenticated
endpoint `GET /api/interview/rag/evaluation` returns retrieval test cases and a
simple relevance-rate metric for the latest report.