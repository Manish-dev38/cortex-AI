import { getModel } from '../config/llmModels.js'
import { generatePdf } from '../utils/generatePdf.js'
import { getFromS3 } from '../utils/getFromS3.js'
import { uploadToS3 } from '../utils/uploadToS3.js'
import { parseJsonFromLlm } from '../utils/parseJson.js'
import { chargeAgent, refundAgent, isInsufficientCredits } from "../utils/credits.js"

const LINK_TTL_SECONDS = 24 * 60 * 60

export const pdfAgent = async (state) => {
    let charged = false

    try {
        const llm = await getModel("pdf")
        const prompt = `
    You are an expert document writer.

    Return ONLY valid JSON.

    DO NOT return markdown.

    DO NOT return explanations.

    Structure:

    {
    "title":"",
    "subtitle":"",
    "sections":[
    {
    "heading":"",
    "points":[]
    }
    ]
    }

    Generate 4-8 sections.

    Each section should have 3-6 concise bullet points.

    Topics: ${state.prompt}

    `

        await chargeAgent(state.userId, "pdf", state.requestId)
        charged = true

        const res = await llm.invoke(prompt)
        const data = parseJsonFromLlm(res.content)

        const pdfBuffer = await generatePdf(data)

        const filename = `pdf-${Date.now()}.pdf`

        await uploadToS3(filename, pdfBuffer, "application/pdf")

        const downloadUrl = await getFromS3(filename, LINK_TTL_SECONDS)

        return {
            ...state,
            aiResponse: `# PDF Generated
            ** ${data.title}**
            [Download PDF](${downloadUrl})

            _Link expires in 24 hours._
            `
        }

    } catch (error) {
        if (charged) {
            await refundAgent(state.userId, "pdf", state.requestId)
        }
        if (isInsufficientCredits(error)) throw error

        console.error("[pdf-agent] generation failed:", error?.message ?? "unknown error")
        return {
            ...state,
            aiResponse: "Failed to generate the PDF. Please try again."
        }
    }
}
