// import { OpenAIEmbeddings } from "@langchain/openai";
// import dotenv from "dotenv"
// dotenv.config()

// export const embeddings = new OpenAIEmbeddings({
//     apiKey: process.env.OPENROUTER_API_KEY, // In Node.js defaults to process.env.OPENAI_API_KEY
//     model: "text-embedding-3-large",
// });


import { OpenAIEmbeddings } from "@langchain/openai";
import dotenv from "dotenv";

dotenv.config();

export const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENROUTER_API_KEY,
    model: "openai/text-embedding-3-large",
    configuration: {
        baseURL: "https://openrouter.ai/api/v1",
    },
});