import { api } from "../../auth/services/auth.api"

/**
 * @description Projects extracted from a report's resume (cached server-side; refresh re-scans).
 */
export const getReportProjects = async (reportId, { refresh = false } = {}) => {
    const response = await api.get(`/api/deep-dive/reports/${reportId}/projects`, { params: refresh ? { refresh: true } : undefined })
    return response.data
}

export const startDeepDive = async (payload) => {
    const response = await api.post("/api/deep-dive", payload)
    return response.data
}

export const getDeepDiveHistory = async (params) => {
    const response = await api.get("/api/deep-dive", { params })
    return response.data
}

export const getDeepDive = async (sessionId) => {
    const response = await api.get(`/api/deep-dive/${sessionId}`)
    return response.data
}

export const answerDeepDive = async (sessionId, answer) => {
    const response = await api.post(`/api/deep-dive/${sessionId}/answer`, { answer })
    return response.data
}

export const finishDeepDive = async (sessionId, { regenerate = false } = {}) => {
    const response = await api.post(`/api/deep-dive/${sessionId}/finish`, { regenerate })
    return response.data
}

export const deleteDeepDive = async (sessionId) => {
    const response = await api.delete(`/api/deep-dive/${sessionId}`)
    return response.data
}
