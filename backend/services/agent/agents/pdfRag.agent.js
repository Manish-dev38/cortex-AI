import crypto from "node:crypto"
import fs from "node:fs"
import { PDFParse } from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { vectorStore } from "../config/vectorDb.js";
import { getModel } from "../config/llmModels.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { chargeAgent, refundAgent, isInsufficientCredits } from "../utils/credits.js";
import { deleteCollection } from "../utils/qdrant.js";

export const pdfRag = async (state) => {
    let charged = false
    let collectionName = null

    try {
        if (!state.file?.path) {
            throw new Error("No PDF upload was provided")
        }

        await chargeAgent(state.userId, "pdf", state.requestId)
        charged = true

        const buffer = fs.readFileSync(state.file.path)
        const pdf = new PDFParse({
            data: buffer
        })

        const result = await pdf.getText()
        const text = result.text

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 500
        })

        const docs = await splitter.createDocuments([text])
        collectionName = `pdf-${state.conversationId}-${crypto.randomUUID()}`

        const store = await vectorStore(docs, collectionName)

        const relevantDocs = await store.similaritySearch(state.prompt, 5)

        const context = relevantDocs.map(d => d.pageContent).join("\n\n")

        const llm = await getModel("pdf-rag")

        const messages = [
            new SystemMessage(`
            You are CortexAI PDF Assistant

            Rules:

            - Answer ONLY from the uploaded PDF.
            - Never make up information.
            - If the answer is not present in the PDF, reply:
            "I couldn't find this information in the uploaded PDF."
            - Use Markdown formatting.
            `),

            new HumanMessage(`
                Context:${context}
                Question:${state.prompt}
                `)
        ]

        const response = await llm.invoke(messages)

        return {
            ...state,
            aiResponse: response.content
        }

    } catch (error) {
        if (charged) {
            await refundAgent(state.userId, "pdf", state.requestId)
        }
        if (isInsufficientCredits(error)) throw error

        console.error("[pdf-rag] analysis failed:", error?.message ?? "unknown error")
        return {
            ...state,
            aiResponse: "Failed to analyze the PDF. Please try again."
        }
    } finally {
        await deleteCollection(collectionName)
    }
}
