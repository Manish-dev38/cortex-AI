import { getModel } from "../config/llmModels.js"

export const router = async (state) => {


    if (state.agent && state.agent !== "auto") {
        return {
            ...state,
            agent: state.agent
        }
    }

    // console.log("file in route => ", state.file?.mimetype)
    if (state?.file) {
        if (state.file?.mimetype === "application/pdf") {
            return {
                ...state,
                agent: "pdfRag"
            }
        }

        if (state.file.mimetype?.startsWith("image/")) {
            return {
                ...state,
                agent: "imageAnalyzer"
            }
        }
    }



    const llm = await getModel("router")

    const prompt = `You are an Agent Router
Available Agents:
- chat
- search
- coding
- pdf
- ppt
- vision

Rules:

chat:
General conversation,
explanation,
learning,
question.

search:
Current events,
latest information,
news,
recent development,
internet looup.

Coding:
Generate code,
debug code,
build projects,
architecture,
API design.

pdf:
Question about generate PDFs
or document context.

ppt:
Question about generate ppts
or ppt context.

vision:
Generate image,
create image.

Return ONLY one words:

chat 
search
coding
pdf
ppt
vision


User Query:
${state.prompt}
`

    const response = await llm.invoke(prompt)

    return {
        ...state,
        agent: response.content
            .trim()
            .toLowerCase()
    }

}
