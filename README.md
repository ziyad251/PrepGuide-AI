<div align="center">

# 🎯 PrepGuide AI

### AI-Powered Personalized Interview Preparation Platform

A full-stack AI-powered interview preparation platform that analyzes a user's **resume** and **target job description** to generate personalized interview questions and a structured preparation roadmap.

<br>

![React](https://img.shields.io/badge/React-Frontend-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-Build_Tool-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-REST_API-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-Authentication-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)

<br>

**Generative AI • Resume Analysis • Interview Preparation • Full-Stack Development**

</div>

---

## 📌 Overview

**PrepGuide AI** is a full-stack AI-powered interview preparation platform designed to make interview preparation more personalized and structured.

Instead of providing the same generic interview questions to every user, the platform analyzes the user's **resume** together with a **target job description** to understand their skills, experience, projects, and the requirements of the role.

Based on this information, the system generates:

- Personalized interview questions
- Role-specific preparation guidance
- A structured preparation roadmap
- Recommendations based on the user's profile and target position

The application combines **Generative AI capabilities** with a modern full-stack architecture using **React.js, Node.js, Express.js, and MongoDB**.

---

# ✨ Key Features

## 🔐 User Authentication

The platform provides secure user authentication and account management.

Users can:

- Create an account
- Log in securely
- Access personalized features
- Manage their profile
- Maintain their interview preparation data

Authentication is implemented using **JSON Web Tokens (JWT)**.

---

## 📄 Resume Upload & Analysis

Users can upload their resumes in **PDF format**.

The application processes the resume to extract relevant information such as:

- Technical skills
- Projects
- Experience
- Education
- Technologies
- Candidate strengths

The extracted information is used to personalize the interview preparation experience.

---

## 💼 Job Description Analysis

Users can provide the job description of their target role.

The system analyzes the job description to identify:

- Required technical skills
- Role responsibilities
- Important technologies
- Expected qualifications
- Key areas of preparation

The resume and job description are then used together to create a more relevant preparation strategy.

---

## 🤖 AI-Powered Interview Question Generation

PrepGuide AI generates personalized interview questions based on:

- The user's resume
- Technical skills
- Projects
- Experience
- Target job description
- Role requirements

Questions can focus on areas such as:

- Technical concepts
- Resume-based discussions
- Project explanations
- Role-specific knowledge
- Behavioral preparation

This provides a more personalized experience than a static collection of interview questions.

---

## 🗺️ Personalized Preparation Roadmap

The platform generates a structured preparation roadmap based on the user's profile and target job requirements.

The roadmap helps users:

- Identify important topics
- Understand skill gaps
- Prioritize preparation areas
- Follow a structured preparation process
- Focus on role-relevant concepts

---

## 🎙️ AI Mock Interview Simulator

A realistic, adaptive interview grounded in the candidate's resume and the analysed job description.

- **Four interview types:** Technical, HR, Behavioural (STAR), and Mixed (alternates technical and behavioural questions).
- **Configurable:** starting difficulty (adapts up or down after each answer) and length (5, 8, or 12 questions; finish early at any time).
- **One question at a time** with a full conversation history, and **contextual follow-ups** when an answer is incomplete or makes a claim worth probing.
- **Per-answer evaluation** of technical correctness, communication and clarity, problem-solving, and relevance, with strengths and missing concepts.
- **Final report:** an overall score out of 100, individual dimension scores, a readiness verdict, strengths, weaknesses, suggested improvements, ideal answer examples for every question, and prioritised topics to revise.
- **History:** every session is saved and can be resumed or revisited from *Interview history*.

Scores are **computed deterministically** from the stored per-answer evaluations (weighted by interview type, so HR rounds weigh communication more and technical rounds weigh correctness more). The LLM writes only the qualitative debrief, so the numbers stay consistent and evidence-backed.

---

## 🧩 Resume Project Deep-Dive Simulator

Prepares candidates to defend the projects on their resume against a senior engineer's questions.

- **Project extraction:** projects, technologies, and claims are extracted from the uploaded resume once and cached on the report. Users can also describe a project manually.
- **Nine focus areas:** architecture, technology choices, database design, API design, authentication and security, performance, scalability, error handling, and real-world scenarios.
- **Challenging, project-specific questions** such as *"Why did you choose this technology?"*, *"What happens if your application receives 10,000 concurrent requests?"*, and *"How would you debug this production issue?"*
- **An interactive interviewer** that follows up on weak or unverified answers (capped at two follow-ups per topic so coverage continues) and otherwise moves to the next uncovered focus area.
- **Project preparation report:** project understanding score, technical knowledge score, per-category breakdown, weak areas, strengths, and the important questions to prepare, each with a suggested answer.

---

## 🛡️ Reliability & Security

- All AI calls stay on the backend; API keys are never exposed to the frontend.
- Every session query is scoped to the authenticated user, so users can only access their own sessions and reports.
- Request bodies are validated with **zod**, and malformed IDs return `400` instead of a server error.
- **AI failures degrade gracefully:**
  - Timed-out or failed question generation falls back to grounded template questions.
  - Failed evaluations are stored as *degraded* and excluded from scoring, rather than recorded as fake scores.
  - Failed final reports fall back to a report built from per-answer feedback, which can be regenerated later.
- Answers are claimed atomically, so a double-submit cannot evaluate the same question twice. If processing fails, the answer is released so the candidate can resubmit.

---

## 👤 Profile Management

Users can manage their personal and professional information through the application.

Profile information can be used to improve the personalization of generated interview preparation content.

---

# 🔄 Application Workflow

```text
User Registration / Login
          │
          ▼
    Profile Setup
          │
          ▼
     Resume Upload
       (PDF File)
          │
          ▼
     Resume Analysis
          │
          ├──────────────┐
          │              │
          ▼              ▼
  Skills & Projects   Experience
     Extraction       Analysis
          │              │
          └──────┬───────┘
                 │
                 ▼
      Enter Job Description
                 │
                 ▼
      Job Requirement Analysis
                 │
                 ▼
       Resume + Job Description
                 │
                 ▼
         AI Processing Layer
          ┌──────┴──────┐
          │             │
          ▼             ▼
 Personalized       Personalized
  Interview         Preparation
  Questions          Roadmap
          │             │
          └──────┬──────┘
                 │
                 ▼
       Interview Preparation
```

---

# 🏗️ System Architecture

```text
                         ┌──────────────────────┐
                         │        User          │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    React Frontend    │
                         │                      │
                         │ • Authentication     │
                         │ • Resume Upload      │
                         │ • Job Description    │
                         │ • Interview Questions│
                         │ • Preparation Roadmap│
                         │ • User Profile       │
                         └──────────┬───────────┘
                                    │
                                    │ REST API
                                    ▼
                         ┌──────────────────────┐
                         │   Express.js API     │
                         │                      │
                         │ • Authentication     │
                         │ • User Management    │
                         │ • Resume Processing  │
                         │ • AI Integration     │
                         │ • Roadmap Generation │
                         └──────┬────────┬──────┘
                                │        │
                    ┌───────────┘        └───────────┐
                    ▼                                ▼
          ┌───────────────────┐            ┌───────────────────┐
          │     MongoDB       │            │    AI Service     │
          │                   │            │                   │
          │ • Users           │            │ • Resume Context  │
          │ • Profiles        │            │ • JD Analysis     │
          │ • Preparation Data│            │ • Question Gen.   │
          └───────────────────┘            │ • Roadmap Gen.    │
                                           └───────────────────┘
```

---

# 🛠️ Tech Stack

| Category | Technology |
|---|---|
| **Frontend** | React.js |
| **Build Tool** | Vite |
| **Styling** | SCSS |
| **HTTP Client** | Axios |
| **Backend** | Node.js |
| **Framework** | Express.js |
| **Database** | MongoDB |
| **Authentication** | JWT |
| **API Architecture** | RESTful APIs |
| **AI** | Google Gemini (`@google/genai`), optional OpenRouter primary with Gemini fallback |
| **Validation** | Zod (request bodies and structured LLM output) |
| **Resume Input** | PDF |
---

# 📁 Project Structure

```text
interview-ai-yt/
├── Backend/
│   ├── server.js
│   ├── src/
│   │   ├── app.js                        # Express app, routes, JSON error handler
│   │   ├── config/                       # database + cookie config
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── interview.controller.js   # plans, mock interview simulator
│   │   │   └── deepDive.controller.js    # project deep-dive
│   │   ├── middlewares/                  # JWT cookie auth, multer upload, zod validation
│   │   ├── models/
│   │   │   ├── interviewReport.model.js  # plan + cached resume projects
│   │   │   ├── interviewSession.model.js # mock interview turns + final report
│   │   │   ├── deepDiveSession.model.js  # deep-dive turns + project report
│   │   │   └── ...
│   │   ├── routes/
│   │   └── services/
│   │       ├── llm.service.js            # structured generation, timeouts, provider fallback
│   │       ├── simulator.service.js      # interview questions, evaluation, final report
│   │       ├── deepDive.service.js       # project extraction, interviewer, project report
│   │       ├── scoring.service.js        # deterministic score aggregation
│   │       ├── sessionTurn.service.js    # atomic answer claim / release
│   │       ├── rag.service.js            # candidate-scoped retrieval
│   │       └── ...
│   └── test/                             # node:test unit + HTTP tests
│
├── Frontend/
│   └── src/
│       ├── components/                   # layout, ConfirmModal, progress
│       └── features/
│           ├── auth/
│           ├── interview/                # plans, mock interview setup / session / report
│           ├── deep-dive/                # project deep-dive hub / session / report
│           ├── practice/                 # shared session UI: thread, composer, scores, report blocks
│           ├── profile/
│           └── landing/
│
├── README.md
└── RUN_PROJECT.md
```

---

# 🚀 Getting Started

## 1. Clone the Repository

```bash
git clone https://github.com/ziyad251/PrepGuide-AI.git
```

Navigate to the project directory:

```bash
cd PrepGuide-AI
```

---

## 2. Backend Setup

Navigate to the backend directory:

```bash
cd Backend
```

Install the required dependencies:

```bash
npm install
```

Create the required environment configuration file:

```text
.env
```

Configure the required environment variables.

Example:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GOOGLE_GENAI_API_KEY=your_gemini_api_key
# optional
GEMINI_MODEL=gemini-3-flash-preview
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
CLIENT_URL=
```

The backend runs on port `3000`. See [RUN_PROJECT.md](RUN_PROJECT.md) for details.

Start the backend server:

```bash
npm run dev
```

---

## 3. Frontend Setup

Open another terminal and navigate to the frontend directory:

```bash
cd Frontend
```

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The Vite development server will display the local application URL in the terminal.

---

# 🔌 API Reference

All routes except register and login require the JWT `token` cookie. Every session and report lookup is scoped to the logged-in user.

### Authentication: `/api/auth`

| Method | Route | Description |
|---|---|---|
| POST | `/register` | Create an account |
| POST | `/login` | Log in (sets the auth cookie) |
| GET | `/logout` | Log out and blacklist the token |
| GET | `/get-me` | Current user |

### Interview plans and mock interviews: `/api/interview`

| Method | Route | Description |
|---|---|---|
| POST | `/` | Generate a plan from a resume PDF / self-description and a job description |
| GET | `/` | List plans |
| GET | `/report/:interviewId` | Get a plan |
| DELETE | `/:interviewId` | Delete a plan |
| POST | `/resume/pdf/:interviewReportId` | Generate a tailored resume PDF |
| POST | `/simulator` | Start a mock interview. Body: `reportId`, `interviewType` (`technical`, `hr`, `behavioral`, `mixed`), `difficulty`, `questionLimit` (3-15), optional `targetRole` |
| GET | `/simulator` | Session history. Query: `status`, `reportId`, `page`, `limit` |
| GET | `/simulator/:sessionId` | Session with transcript and final report |
| POST | `/simulator/:sessionId/answer` | Answer the current question (`{ answer }`); returns the evaluation, the next question, and `readyToFinish` |
| POST | `/simulator/:sessionId/finish` | Finish and generate the final report. Idempotent; `{ regenerate: true }` retries a fallback report |
| POST | `/simulator/:sessionId/roadmap/recalculate` | Update the roadmap from interview evidence |

### Project deep-dive: `/api/deep-dive`

| Method | Route | Description |
|---|---|---|
| GET | `/reports/:reportId/projects` | Projects extracted from the plan's resume (cached; `?refresh=true` re-scans) |
| POST | `/` | Start. Body: `reportId`, either `projectId` or `customProject` (`name`, `description`, `technologies`), `difficulty`, `focusAreas`, `questionLimit` |
| GET | `/` | Deep-dive history |
| GET | `/:sessionId` | Session with transcript and report |
| POST | `/:sessionId/answer` | Answer the current question (`{ answer }`) |
| POST | `/:sessionId/finish` | Generate the project preparation report. Idempotent; supports `{ regenerate: true }` |
| DELETE | `/:sessionId` | Delete a session |

---

# 🔐 Authentication Flow

```text
User Registration
       │
       ▼
Password Processing
       │
       ▼
User Stored in MongoDB
       │
       ▼
      Login
       │
       ▼
JWT Token Generated
       │
       ▼
Protected API Access
       │
       ▼
Personalized User Experience
```

JWT-based authentication is used to protect application routes and user-specific resources.

---

# 🤖 AI Personalization Pipeline

```text
           Resume
              │
              ▼
      Resume Information
          Processing
              │
              ▼
     Candidate Profile Context
              │
              │
Job Description ──────────────┐
              │               │
              ▼               │
     Job Requirement Context  │
              │               │
              └───────┬───────┘
                      │
                      ▼
               Combined Context
                      │
                      ▼
                AI Processing
                 ┌────┴────┐
                 │         │
                 ▼         ▼
           Interview    Preparation
            Questions     Roadmap
```

The goal of the pipeline is to generate preparation content that is specific to both the **candidate** and the **target role**.

---


```


# 🤝 Contributing

Contributions and suggestions are welcome.

```bash
# Create a new branch
git checkout -b feature/your-feature

# Commit your changes
git commit -m "feat: add your feature"

# Push your branch
git push origin feature/your-feature
```

Then open a Pull Request.

---

# ⭐ Support

If you find this project useful or interesting, consider giving the repository a **⭐ star**.

<div align="center">

### Built with 🤖 Generative AI, ⚛️ React, 🟢 Node.js, and 🍃 MongoDB

</div>
