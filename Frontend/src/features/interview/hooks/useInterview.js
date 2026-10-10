import {
    getAllInterviewReports,
    generateInterviewReport,
    getInterviewReportById,
    generateResumePdf,
    deleteInterviewReport,
} from "../services/interview.api"
import { useContext, useEffect } from "react"
import { InterviewContext } from "../interview.context"
import { useParams } from "react-router"

export const useInterview = () => {
    const context = useContext(InterviewContext)
    const { interviewId } = useParams()

    if (!context) {
        throw new Error("useInterview must be used within an InterviewProvider")
    }

    const {
        loading,
        setLoading,
        generating,
        setGenerating,
        report,
        setReport,
        reports,
        setReports,
    } = context

    const generateReport = async ({ jobDescription, selfDescription, resumeFile }) => {
        setGenerating(true)
        let response = null
        try {
            response = await generateInterviewReport({ jobDescription, selfDescription, resumeFile })
            setReport(response.interviewReport)
            return response.interviewReport
        } catch (error) {
            console.log(error)
            throw error
        } finally {
            setGenerating(false)
        }
    }

    const getReportById = async (id) => {
        setLoading(true)
        let response = null
        try {
            response = await getInterviewReportById(id)
            setReport(response.interviewReport)
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
        return response?.interviewReport
    }

    const getReports = async () => {
        setLoading(true)
        let response = null
        try {
            response = await getAllInterviewReports()
            setReports(response.interviewReports)
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
        return response?.interviewReports
    }

    const deleteReport = async (id) => {
        try {
            await deleteInterviewReport(id)
            setReports((prev) => prev.filter((r) => r._id !== id))
            if (report?._id === id) {
                setReport(null)
            }
        } catch (error) {
            console.log(error)
            throw error
        }
    }

    const getResumePdf = async (interviewReportId) => {
        setLoading(true)
        try {
            const response = await generateResumePdf({ interviewReportId })
            const url = window.URL.createObjectURL(new Blob([response], { type: "application/pdf" }))
            const link = document.createElement("a")
            link.href = url
            link.setAttribute("download", `resume_${interviewReportId}.pdf`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (interviewId) {
            getReportById(interviewId)
        }
    }, [interviewId])

    return {
        loading,
        generating,
        report,
        reports,
        generateReport,
        getReportById,
        getReports,
        getResumePdf,
        deleteReport,
    }
}
