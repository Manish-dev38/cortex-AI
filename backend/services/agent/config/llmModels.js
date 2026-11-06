import { ChatGroq } from "@langchain/groq"
import { ChatOpenRouter } from "@langchain/openrouter";

const groq = new ChatGroq({
    model: "groq/compound",
    temperature: 0,
    maxRetries: 2,
})

const groqMini = new ChatGroq({
    model: "groq/compound-mini",
    temperature: 0,
    maxRetries: 2,
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

const MODELS = {
    chat: groq,
    search: groq,
    coding: openRouter,
    pdf: groq,
    ppt: groq,
    "pdf-rag": openRouter,
    image: groq,
    imageAnalyzer: openRouter2,
    router: groqMini,
    intent: groqMini,
};

/**
 * Explicit routing: every agent maps to exactly one model. The previous
 * `groq || groq2` expressions meant the second model was unreachable.
 */
export const getModel = async (agent) => {
    return MODELS[agent] || groq;
}
