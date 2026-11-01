import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
    withCredentials: true,
})


/**
 * @description Service to generate interview report based on user self description, resume and job description.
 */
export const generateInterviewReport = async ({ jobDescription, selfDescription, resumeFile }) => {

    const formData = new FormData()
    formData.append("jobDescription", jobDescription)
    formData.append("selfDescription", selfDescription)
    if (typeof File !== "undefined" && resumeFile instanceof File) {
        formData.append("resume", resumeFile, resumeFile.name)
    }
    console.log("[SETUP] FormData resume present", {
        present: formData.has("resume"),
        name: resumeFile?.name || "",
        type: resumeFile?.type || "",
    })

    const response = await api.post("/api/interview/", formData)

    return response.data

}


/**
 * @description Service to get interview report by interviewId.
 */
export const getInterviewReportById = async (interviewId) => {
    const response = await api.get(`/api/interview/report/${interviewId}`)

    return response.data
}


/**
 * @description Service to get all interview reports of logged in user.
 */
export const getAllInterviewReports = async () => {
    const response = await api.get("/api/interview/")

    return response.data
}


/**
 * @description Service to generate resume pdf based on user self description, resume content and job description.
 */
export const generateResumePdf = async ({ interviewReportId }) => {
    const response = await api.post(`/api/interview/resume/pdf/${interviewReportId}`, null, {
        responseType: "blob"
    })

    return response.data
}

/**
 * @description Delete an interview report by id.
 */
export const deleteInterviewReport = async (interviewId) => {
    const response = await api.delete(`/api/interview/${interviewId}`)
    return response.data
}

export const startSimulator = async (payload) => {
    const response = await api.post("/api/interview/simulator", payload)
    return response.data
}

export const answerSimulator = async (sessionId, answer) => {
    const response = await api.post(`/api/interview/simulator/${sessionId}/answer`, { answer })
    return response.data
}

export const runEvaluationSuite = async () => {
    const response = await api.post("/api/interview/evaluation-suite/run")
    return response.data
}

export const getEvaluationSuite = async () => {
    const response = await api.get("/api/interview/evaluation-suite")
    return response.data
}

export const getRagEvaluation = async () => {
    const response = await api.get("/api/interview/rag/evaluation")
    return response.data
}

export const getSimulator = async (sessionId) => {
    const response = await api.get(`/api/interview/simulator/${sessionId}`)
    return response.data
}

export const getSimulatorHistory = async (params) => {
    const response = await api.get("/api/interview/simulator", { params })
    return response.data
}

export const recalculateRoadmap = async (sessionId) => {
    const response = await api.post(`/api/interview/simulator/${sessionId}/roadmap/recalculate`)
    return response.data
}

/**
 * @description Finish a mock interview and generate its final report. Pass { regenerate: true } to retry a fallback report.
 */
export const finishSimulator = async (sessionId, { regenerate = false } = {}) => {
    const response = await api.post(`/api/interview/simulator/${sessionId}/finish`, { regenerate })
    return response.data
}
