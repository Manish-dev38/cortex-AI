import { getModel } from "../config/llmModels.js"
import { deductCredits } from "../utils/deductCredits.js"

export const codingAgent = async (state) => {
    const intentLlm = await getModel("intent")
    const llm = await getModel("coding")
    const intentResponse = await intentLlm.invoke(`
        You are an intent classifire.

        Return ONLY of these values.

        CODE_GENERATION
        CODE_REVIEW
        CODE_EXPLANATION
        DEBUGGING
        OPTIMIZATION
        CONVERSATION
        DOCUMENTION

        User Request:
        ${state.prompt}
        `)

    await deductCredits(state.userId, "coding")

    const intent = intentResponse.content
    if (intent == "CODE_GENERATION") {
        const prompt = ` 
        You are CortexAI Coding Agent.

        Generate the requested project.

        Default stack:
        - HTML
        - CSS
        - JavaScript


        Use React / Node.js / Vue ONLY if expilicitly requested.

        Rules:
        - Responsive
        - Modern UI
        - CSS Variables 
        - Flexbox/Grid
        - Smooth Scroll
        - Hover Effects
        - Beautiful spacing
        - Single page unless user aks otherwise

        IMAGES
        ================================

        Always use real Unplash images.
        
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
        },
        ]
        }

        Rules:
        - Output must starts with {
        - Output must ends with }
        - No markdown
        - No explanation
        - No extra text
        - No \`\`\`
        - Never mention intent

        User Request:
        ${state.prompt}
        `
        const res = await llm.invoke(prompt)

        let text = res.content.trim();

        if (text.startsWith("```")) {
            text = text
                .replace(/^```json\s*/i, "")
                .replace(/^```\s*/i, "")
                .replace(/\s*```$/, "")
                .trim();
        }

        console.log(res)


        const data = JSON.parse(text)



        data.files = (data.files || []).map(file => ({
            name: file.name || file.names || file.filename || file.file_name,
            content: file.content
        }));

        await deductCredits(state.userId, "coding")

        return {
            ...state,
            aiResponse: "Code Generated Successfully.",
            artifacts: [
                {
                    id: Date.now(),
                    type: "Project",
                    files: data.files || [],
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

        #Problems

        #Improvements

        #Best Pratices

        # Optimized Code (if needed)

        User Request: ${state.prompt}
        `)

    const data = res.content
    return {
        ...state,
        aiResponse: data,
        artifacts: []
    }
}
