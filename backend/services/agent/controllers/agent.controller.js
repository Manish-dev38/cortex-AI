import axios from 'axios'
import { graph } from '../graph/graph.js'
import { addMessage } from '../config/memory.js'
import redis from '../../../shared/redis/redis.js'


export const agent = async (req, res) => {
    try {
        const { prompt, conversationId, agent: selectedAgent } = req.body
        const file = req.file
        console.log("File:->", file)
        const userId = req.headers["x-user-id"]

        const result = await graph.invoke({
            prompt,
            conversationId,
            agent: selectedAgent,
            userId,
            file
        })

        console.log("REsults-=>", result)

        const response = result.aiResponse

        // console.log("Graph Result:", result)
        // console.log("AI Response:", response)

        // Save user message
        await axios.post(`${process.env.CHAT_SERVICE}/save-message`, {
            conversationId,
            role: "user",
            content: prompt
        })

        // console.log({
        //     conversationId,
        //     role: "assistant",
        //     content: response,
        //     images: result?.images,
        //     artifacts: result?.artifacts
        // })

        // Save AI message
        await axios.post(`${process.env.CHAT_SERVICE}/save-message`, {
            conversationId,
            role: "assistant",
            content: response,
            images: result?.images,
            artifacts: result?.artifacts
        })

        await addMessage(conversationId, "user", prompt)
        await addMessage(conversationId, "assistant", response)


        return res.status(200).json({
            answer: response,
            images: result?.images,
            artifacts: result?.artifacts
        })

    } catch (error) {
        console.error(error);


        return res.status(500).json({ message: `agent error ${error}` })
    }
}
