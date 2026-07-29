import { ChatGroq } from "@langchain/groq"
import { ChatOpenRouter } from "@langchain/openrouter";

const groq = new ChatGroq({
    model: "groq/compound",
    temperature: 0,
    maxTokens: undefined,
    maxRetries: 2,
    // other params...
})// can add more llm 

const groq2 = new ChatGroq({
    model: "groq/compound-mini",
    temperature: 0,
    maxTokens: undefined,
    maxRetries: 2,
    // other params...
})

const openRouter = new ChatOpenRouter({
    model: "deepseek/deepseek-chat",
    temperature: 0,
    maxTokens: 2500,
})

const openRouter2 = new ChatOpenRouter({
    model: "google/gemma-4-31b-it:free",
    temperature: 0,
    maxTokens: 2500,
})

export const getModel = async (agent) => {
    switch (agent) {
        case "chat":
            return groq || groq2;
        case "search":
            return groq || groq2  // add more for different llm 

        case "coding":
            return openRouter;

        case "imageAnalyzer":
            return openRouter2

        default:
            return groq;
    }
}