import { SystemMessage } from "@langchain/core/messages"
import { HumanMessage } from "@langchain/core/messages";
import { getModel } from "../config/llmModels.js"
import fs from "node:fs/promises"
import { chargeAgent, refundAgent, isInsufficientCredits } from "../utils/credits.js"

export const imageAnalyzer = async (state) => {
    let charged = false

    try {
        if (!state.file?.path) {
            throw new Error("No image upload was provided")
        }

        const llm = await getModel("imageAnalyzer")

        await chargeAgent(state.userId, "vision", state.requestId)
        charged = true

        const imageBuffer = await fs.readFile(state.file.path)
        const base64Image = imageBuffer.toString("base64")

        const messages = [
            new SystemMessage(
                `You are CortexAI Vision Agent
                
                Rules:

                - Analyze only the uploaded image.
                - Answer the user's question accurately.
                - If text exists in the image, extract it.
                - If charts or tables exist, explain them.
                - If something is unclear, say so.
                - Use Markdown when helpful.
                - Do not hallucinate.
                `
            ),
            new HumanMessage(
                {
                    content: [
                        {
                            type: "text",
                            text: state.prompt || "Analyze the image"
                        },
                        {
                            type: "image_url",
                            "image_url": {
                                url: `data:${state.file.mimetype};base64,${base64Image}`
                            }
                        }
                    ]
                }
            )
        ]

        const response = await llm.invoke(messages)

        return {
            ...state,
            aiResponse: response.content
        }
    } catch (error) {
        if (charged) {
            await refundAgent(state.userId, "vision", state.requestId)
        }
        if (isInsufficientCredits(error)) throw error

        console.error("[image-analyzer] analysis failed:", error?.message ?? "unknown error")
        return {
            ...state,
            aiResponse: 'Failed to analyze the file. Please try again.'
        }
    }
}
