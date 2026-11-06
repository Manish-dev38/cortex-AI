import { getModel } from "../config/llmModels.js"
import { parseJsonFromLlm } from "../utils/parseJson.js"
import { chargeAgent, refundAgent, isInsufficientCredits } from "../utils/credits.js"

const INTENTS = [
    "CODE_GENERATION",
    "CODE_REVIEW",
    "CODE_EXPLANATION",
    "DEBUGGING",
    "OPTIMIZATION",
    "CONVERSATION",
    "DOCUMENTATION",
];

export const codingAgent = async (state) => {
    let charged = false

    try {
        const intentLlm = await getModel("intent")
        const llm = await getModel("coding")

        await chargeAgent(state.userId, "coding", state.requestId)
        charged = true

        const intentResponse = await intentLlm.invoke(`
        You are an intent classifier.

        Return ONLY one of these values.

        CODE_GENERATION
        CODE_REVIEW
        CODE_EXPLANATION
        DEBUGGING
        OPTIMIZATION
        CONVERSATION
        DOCUMENTATION

        User Request:
        ${state.prompt}
        `)

        const rawIntent = String(intentResponse.content ?? "").trim().toUpperCase()
        const intent = INTENTS.find((value) => rawIntent.includes(value)) || "CONVERSATION"

        if (intent === "CODE_GENERATION") {
            const prompt = `
        You are CortexAI Coding Agent.

        Generate the requested project.

        Default stack:
        - HTML
        - CSS
        - JavaScript


        Use React / Node.js / Vue ONLY if explicitly requested.

        Rules:
        - Responsive
        - Modern UI
        - CSS Variables
        - Flexbox/Grid
        - Smooth Scroll
        - Hover Effects
        - Beautiful spacing
        - Single page unless user asks otherwise

        IMAGES
        ================================

        Always use real Unsplash images.

        Never use placeholders.

        Return ONLY valid JSON.


        Schema:

        {
        "files":[
        {
        "name":"index.html",
        "content":"..."
        },
        {
        "name":"style.css",
        "content":"..."
        },
        {
        "name":"script.js",
        "content":"..."
        }
        ]
        }

        Rules:
        - Output must start with {
        - Output must end with }
        - No markdown
        - No explanation
        - No extra text
        - No \`\`\`
        - Never mention intent

        User Request:
        ${state.prompt}
        `
            const res = await llm.invoke(prompt)
            const data = parseJsonFromLlm(res.content)

            const files = (data.files || []).map(file => ({
                name: file.name || file.names || file.filename || file.file_name,
                content: file.content
            })).filter((file) => typeof file.name === "string" && typeof file.content === "string")

            if (files.length === 0) {
                throw new Error("Model returned no files")
            }

            return {
                ...state,
                aiResponse: "Code Generated Successfully.",
                artifacts: [
                    {
                        id: Date.now(),
                        type: "Project",
                        files,
                        title: state.prompt
                    }
                ]
            }

        }

        const res = await llm.invoke(`
        The user's request is: ${intent}

        Return Markdown only.

        Never generate project files.

        Use headings like:
        # Overview

        # Explanation

        # Problems

        # Improvements

        # Best Practices

        # Optimized Code (if needed)

        User Request: ${state.prompt}
        `)

        return {
            ...state,
            aiResponse: res.content,
            artifacts: []
        }
    } catch (error) {
        if (charged) {
            await refundAgent(state.userId, "coding", state.requestId)
        }
        if (isInsufficientCredits(error)) throw error

        console.error("[coding-agent] generation failed:", error?.message ?? "unknown error")
        return {
            ...state,
            aiResponse: "I could not complete the coding request. Please try again.",
            artifacts: []
        }
    }
}
