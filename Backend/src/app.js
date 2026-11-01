const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")

const app = express()

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    process.env.CLIENT_URL,
].filter(Boolean)

app.use(cors({
    origin(origin, callback) {
        // Allow non-browser clients (curl, Postman) and listed dev origins
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true)
        } else {
            callback(new Error(`CORS blocked for origin: ${origin}`))
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}))

app.use(express.json())
app.use(cookieParser())

/* require all the routes here */
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")

/* using all the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)

/* JSON error handler: Express 5 forwards rejected async handlers here */
app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    if (error.name === "CastError") return res.status(400).json({ message: "Invalid identifier." })
    if (error.type === "entity.parse.failed") return res.status(400).json({ message: "Request body must be valid JSON." })
    console.error("[API] unhandled error", { method: req.method, path: req.path, name: error.name, message: error.message })
    res.status(error.status || 500).json({
        message: "Something went wrong. Please try again.",
        detail: process.env.NODE_ENV === "production" ? undefined : error.message,
    })
})

module.exports = app
