import { getModel } from "../config/llmModels.js"
import axios from 'axios'
import { uploadToS3 } from "../utils/uploadToS3.js"
import { getFromS3 } from "../utils/getFromS3.js"
import { deductCredits } from "../utils/deductCredits.js"

export const visionAgent = async (state) => {
    try {
        const llm = await getModel("image")
        const res = await llm.invoke(`
        You are an elite AI image prompt engineer.

        Convert the user request into a highly detailed image generation prompt.

        Requirements:

        - Cinematic lighting
        - Professional composition
        - Ultra realistic
        - High detail
        - Beautiful color palette
        - Sharp focus
        - BK quality
        - 8K quality
        - Photorealistic
        - Depth of field
        - Professional
        - Stunning visuals

        Return Only the image prompt.

        User Request: ${state.prompt}
        `)

        const prompt = res.content.trim()

        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`

        const imageRes = await axios.get(imageUrl, { responseType: "arraybuffer" })

        await deductCredits(state.userId, "vision")

        const buffer = Buffer.from(imageRes.data)
        const filename = `image-${Date.now()}.png`

        await uploadToS3(filename, buffer, "image/png")

        const downloadUrl = await getFromS3(filename, 72 * 60 * 60)

        // return {
        //     ...state,
        //     aiResponse: `
        // #  Image Generated Successfully

        // ![Generated Image](${downloadUrl})

        // [Download Image](${downloadUrl})

        // Link expires in 10 minutes.
        // `
        // }
        return {
            ...state,
            aiResponse: "Image generated successfully.",
            images: [downloadUrl]
        }
    } catch (error) {
        return {
            ...state,
            aiResponse: "❌ Failed To generate image"
        }
    }
}