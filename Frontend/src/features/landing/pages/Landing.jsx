import { Link } from "react-router"
import Navbar from "../../../components/layout/Navbar"
import "../style/landing-premium.scss"

const flow = ["Resume + target role", "Candidate skill profile", "Adaptive interview", "Answer evidence", "Personalized roadmap"]
const pillars = [
    ["Adaptive interviews", "Every answer influences what comes next, so practice follows your actual reasoning instead of a fixed question list."],
    ["Evidence-based skills", "See what you demonstrated, what remains unassessed, and where the interview found a specific gap."],
    ["Preparation that moves", "Your roadmap turns the latest evidence into focused study priorities you can act on."],
]

const Landing = () => <div className="landing-premium"><Navbar variant="public" /><main><section className="landing-premium__hero"><div className="landing-premium__hero-copy"><p className="eyebrow">Interview intelligence for serious preparation</p><h1>Prepare smarter.<br /><em>Interview with evidence.</em></h1><p>PrepGuide AI adapts every interview to your skills, answers, target role, and areas for improvement.</p><div className="landing-premium__actions"><Link to="/register" className="button primary-button">Start preparing</Link><a href="#how-it-works" className="button secondary-button">Explore how it works</a></div></div><div className="landing-premium__hero-note"><span>01</span><p>Every question has a reason.</p><small>Your role context and demonstrated evidence guide the next focus.</small></div></section><section id="how-it-works" className="landing-premium__flow"><div className="landing-premium__section-heading"><p className="eyebrow">The preparation loop</p><h2>From context to confident answers.</h2></div><div className="flow-line">{flow.map((item, index) => <div className="flow-step" key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong>{index < flow.length - 1 && <i>→</i>}</div>)}</div></section><section className="landing-premium__pillars"><div className="landing-premium__section-heading"><p className="eyebrow">Why PrepGuide</p><h2>A clearer signal for every practice session.</h2></div><div className="pillar-grid">{pillars.map(([title, text], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section><section className="landing-premium__cta"><p className="eyebrow">Your next interview is a data point</p><h2>Turn preparation into a system.</h2><Link to="/register" className="button primary-button">Create your workspace</Link></section></main><footer className="landing-premium__footer"><span>PrepGuide AI</span><span>Adaptive practice · Evidence · Direction</span></footer></div>

export default Landing
