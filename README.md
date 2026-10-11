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
| **AI** | Generative AI |
| **Resume Input** | PDF |
---

# 📁 Project Structure

```text
PrepGuide-AI/
│
├── Backend/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   └── ...
│
├── Frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── ...
│   └── ...
│
├── assets/
│   ├── screenshots/
│   │   ├── home.png
│   │   ├── login.png
│   │   ├── resume-upload.png
│   │   ├── job-description.png
│   │   ├── interview-questions.png
│   │   └── roadmap.png
│   │
│   └── demo.gif
│
├── README.md
└── RUN_PROJECT.md
```

> The exact internal structure may vary depending on the current implementation.

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
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
AI_API_KEY=your_ai_api_key
```

> Environment variable names may differ depending on the current project configuration.

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

# 🔌 Core API Functionality

The backend provides RESTful APIs for the major application features.

### Authentication

```text
User Registration
User Login
JWT Authentication
Protected Routes
```

### User Management

```text
User Profile
Profile Updates
User Data Management
```

### Resume Processing

```text
PDF Resume Upload
Resume Processing
Resume-Based Context Generation
```

### Interview Preparation

```text
Job Description Analysis
Personalized Question Generation
Preparation Roadmap Generation
```

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
