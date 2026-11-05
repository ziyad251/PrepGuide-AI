import { Link } from "react-router"
import Navbar from "../../../components/layout/Navbar"
import DemoButton from "../../auth/components/DemoButton"
import { useDemoLogin } from "../../auth/hooks/useDemoLogin"
import "../style/landing.scss"

const GITHUB_URL = "https://github.com/ziyad251/PrepGuide-AI"

const steps = [
    { title: "Paste the JD + resume", text: "Drop in the job description and your resume, as text or a PDF." },
    { title: "Skill gaps mapped", text: "The role's requirements are matched against what your resume shows." },
    { title: "Adaptive mock interview", text: "Questions follow up on what you actually said, not a fixed list." },
    { title: "Evidence on each skill", text: "Every answer is scored and tied back to the skills it demonstrates." },
    { title: "Personalised roadmap", text: "A day-by-day plan built around the gaps that showed up." },
]

const stack = [
    "React",
    "Node.js / Express",
    "MongoDB",
    "Gemini",
    "RAG (retrieval-grounded questions)",
    "Zod-validated structured output",
    "JWT auth",
    "Docker on AWS EC2",
]

/* ---------- Small HTML mocks for the feature list ---------- */

const MockInterviewMock = () => (
    <div className="mock mock--chat" aria-hidden="true">
        <p className="mock__label">Interviewer</p>
        <p className="mock__q">How does your service handle a payment webhook that arrives twice?</p>
        <p className="mock__label">You</p>
        <p className="mock__a">We check an event ID before writing, so a repeat is ignored.</p>
        <div className="mock__followup">
            <span className="tag">Follow-up</span>
            <p>Where is that event ID stored, and what happens if the write fails halfway?</p>
        </div>
    </div>
)

const DeepDiveMock = () => (
    <div className="mock mock--project" aria-hidden="true">
        <div className="mock__project">
            <p className="mock__label">From your resume</p>
            <strong>Order tracking service</strong>
            <span>Node.js · MongoDB · Redis</span>
        </div>
        <ol className="mock__questions">
            <li><span className="tag">Database design</span>Why did orders and shipments end up in separate collections?</li>
            <li><span className="tag">Performance</span>What did Redis actually fix, and how did you measure it?</li>
            <li><span className="tag">Error handling</span>What happens to an order when the carrier API times out?</li>
        </ol>
    </div>
)

const SkillsMock = () => (
    <div className="mock mock--skills" aria-hidden="true">
        <div className="mock__skill-col">
            <p className="mock__label">Demonstrated</p>
            <span className="mock__skill is-shown">REST API design</span>
            <span className="mock__skill is-shown">MongoDB indexing</span>
        </div>
        <div className="mock__skill-col">
            <p className="mock__label">Observed gaps</p>
            <span className="mock__skill is-gap">Caching strategy</span>
        </div>
        <div className="mock__skill-col">
            <p className="mock__label">Needs evidence</p>
            <span className="mock__skill">Message queues</span>
            <span className="mock__skill">CI/CD</span>
        </div>
    </div>
)

const RoadmapMock = () => (
    <div className="mock mock--roadmap" aria-hidden="true">
        {[
            ["Day 1", "Caching patterns", "Cache-aside vs write-through; when to invalidate."],
            ["Day 2", "Redis in practice", "Add a cache to one endpoint and explain the trade-offs aloud."],
            ["Day 3", "Re-test", "A short mock interview focused on caching."],
        ].map(([day, focus, task]) => (
            <div className="mock__day" key={day}>
                <span className="mock__day-num">{day}</span>
                <div>
                    <strong>{focus}</strong>
                    <p>{task}</p>
                </div>
            </div>
        ))}
    </div>
)

const HistoryMock = () => (
    <div className="mock mock--history" aria-hidden="true">
        {[
            ["Mock interview", "Backend Developer", "Report ready"],
            ["Project deep-dive", "Order tracking service", "Report ready"],
            ["Interview plan", "Backend Developer", "Plan + roadmap"],
        ].map(([kind, title, status]) => (
            <div className="mock__row" key={kind}>
                <div>
                    <p className="mock__label">{kind}</p>
                    <strong>{title}</strong>
                </div>
                <span className="mock__open">{status} <span aria-hidden="true">→</span></span>
            </div>
        ))}
    </div>
)

const features = [
    {
        title: "An adaptive mock interview",
        text: "Each question is chosen from your target role, your resume and your previous answer. Say something vague and the next question asks you to be specific; answer well and it moves on to the next skill.",
        points: ["Technical, HR, behavioural or mixed rounds", "Follow-ups based on your actual answer", "Questions grounded in retrieved role context (RAG)"],
        Mock: MockInterviewMock,
    },
    {
        title: "A deep-dive on your own projects",
        text: "Interviewers ask about what's on your resume. Pick a project and get questioned on why you built it the way you did: the architecture, the database, the failure cases.",
        points: ["Architecture, API design, auth, scalability and more", "Questions written around the project you choose"],
        Mock: DeepDiveMock,
    },
    {
        title: "Skill intelligence, not a single score",
        text: "Every skill the role needs ends up in one of three places: demonstrated in an answer, a gap the interview observed, or relevant but not tested yet. You can see exactly what still needs evidence.",
        points: ["Evidence quoted from your own answers", "Updated after every session"],
        Mock: SkillsMock,
    },
    {
        title: "A day-by-day roadmap",
        text: "Your preparation plan is built from the gaps that actually showed up, and you can recalculate it after each interview so it keeps pointing at what's left.",
        points: ["Daily focus areas and concrete tasks", "Recalculated from new interview evidence"],
        Mock: RoadmapMock,
    },
    {
        title: "Interview history & reports",
        text: "Every plan, mock interview and project deep-dive is saved with a written report: how each answer was scored, what it showed, and what to work on next.",
        points: ["Per-answer feedback and scores", "Reports you can revisit before the real thing"],
        Mock: HistoryMock,
    },
]

/* ---------- Hero visual: an animated interview transcript ---------- */

const answerLines = [
    "I'd keep the resources as nouns: /orders and /orders/:id,",
    "with POST returning 201 and the new order in the body.",
    "Errors share one JSON shape, so clients handle them once.",
]

const TranscriptCard = () => (
    <figure className="transcript" aria-label="Example: a mock interview exchange and the evidence it produced">
        <div className="transcript__bar">
            <span>Mock interview</span>
            <span>Backend Developer</span>
        </div>

        <div className="transcript__body">
            <div className="transcript__turn transcript__turn--q">
                <p className="transcript__who">Interviewer</p>
                <p className="transcript__question">How would you design the API for an orders service?</p>
            </div>

            <div className="transcript__turn transcript__turn--a">
                <p className="transcript__who">You</p>
                {answerLines.map((line, index) => (
                    <span className="transcript__line" style={{ "--i": index }} key={line}>{line}</span>
                ))}
            </div>
        </div>

        <figcaption className="transcript__evidence">
            <p className="transcript__evidence-title">Evidence from this answer</p>
            <p className="transcript__evidence-row">
                <span className="tag tag--shown">Demonstrated</span> REST API design
            </p>
            <p className="transcript__evidence-row">
                <span className="tag tag--gap">Gap</span> Caching strategy
            </p>
        </figcaption>
    </figure>
)

const Landing = () => {
    const demo = useDemoLogin()

    return (
        <div className="landing">
            <a href="#main" className="skip-link">Skip to content</a>
            <Navbar demo={demo} />

            <main id="main">
                {/* 1 · Hero */}
                <section className="hero wrap">
                    <div className="hero__copy">
                        <p className="kicker">Interview preparation, from the job description up</p>
                        <h1>Prepare for the interview <em>you're</em> actually facing.</h1>
                        <p className="hero__sub">
                            Paste a job description and your resume. Get your skill gaps,
                            role-specific questions and a day-by-day plan.
                        </p>
                        <div className="hero__actions">
                            <DemoButton demo={demo} source="hero" />
                            <Link to="/register" className="text-link">Create an account <span aria-hidden="true">→</span></Link>
                        </div>
                        <p className="hero__note">The demo signs you in to a shared sample account. No sign-up needed.</p>
                    </div>
                    <div className="hero__visual">
                        <TranscriptCard />
                    </div>
                </section>

                {/* 2 · Timeline */}
                <section id="how-it-works" className="section wrap">
                    <header className="section__head">
                        <p className="kicker">How it works</p>
                        <h2>From job description to plan.</h2>
                    </header>
                    <ol className="timeline">
                        {steps.map((step, index) => (
                            <li className="timeline__step" key={step.title}>
                                <span className="timeline__num">{String(index + 1).padStart(2, "0")}</span>
                                <h3>{step.title}</h3>
                                <p>{step.text}</p>
                            </li>
                        ))}
                    </ol>
                </section>

                {/* 3 · Features */}
                <section id="features" className="section wrap">
                    <header className="section__head section__head--split">
                        <div>
                            <p className="kicker">Features</p>
                            <h2>What you get to work with.</h2>
                        </div>
                        <p className="section__lede">
                            Five parts of one loop: practise, see the evidence, fix the gaps, practise again.
                        </p>
                    </header>

                    <div className="features">
                        {features.map((feature, index) => {
                            const { title, text, points, Mock: FeatureMock } = feature
                            return (
                            <article className={`feature ${index % 2 ? "feature--flip" : ""}`} key={title}>
                                <div className="feature__text">
                                    <span className="feature__index">{String(index + 1).padStart(2, "0")}</span>
                                    <h3>{title}</h3>
                                    <p>{text}</p>
                                    <ul>
                                        {points.map((point) => <li key={point}>{point}</li>)}
                                    </ul>
                                </div>
                                <div className="feature__mock">
                                    <FeatureMock />
                                </div>
                            </article>
                            )
                        })}
                    </div>
                </section>

                {/* 4 · Under the hood */}
                <section className="stack wrap" aria-labelledby="stack-title">
                    <h2 id="stack-title" className="stack__title">Under the hood</h2>
                    <p className="stack__list">
                        {stack.map((item, index) => (
                            <span key={item}>
                                {item}{index < stack.length - 1 && <span className="stack__dot" aria-hidden="true"> · </span>}
                            </span>
                        ))}
                    </p>
                </section>

                {/* 5 · Closing band */}
                <section className="closing">
                    <div className="wrap closing__inner">
                        <h2>Your next interview is specific. <span>Your preparation should be too.</span></h2>
                        <DemoButton demo={demo} source="closing" className="closing__button" />
                    </div>
                </section>
            </main>

            <footer className="footer wrap">
                <span className="footer__mark">PrepGuide</span>
                <span className="footer__by">Built by Mahammad Ziyad</span>
                <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-link">GitHub <span aria-hidden="true">↗</span></a>
            </footer>
        </div>
    )
}

export default Landing
