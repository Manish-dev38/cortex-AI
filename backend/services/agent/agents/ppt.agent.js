import { getModel } from "../config/llmModels.js"
import { uploadToS3 } from "../utils/uploadToS3.js"
import { generatePpt } from "../utils/generatePpt.js"
import { getFromS3 } from "../utils/getFromS3.js"
import { deductCredits } from "../utils/deductCredits.js"

export const pptAgent = async (state) => {
  try {
    const llm = await getModel("ppt")
    const prompt = `
You are an elite presentation strategist and PowerPoint expert.

Your job is to create presentations that are:
- Executive-quality
- Visually clean
- Logically structured
- Concise but informative
- Suitable for business, education, and technical audiences.

Return ONLY valid JSON.

DO NOT return markdown.

DO NOT return explanations.

DO NOT wrap the JSON inside code blocks.

Return this exact structure:

{
  "title": "",
  "subtitle": "",
  "theme": "professional",
  "slides": [
    {
      "title": "",
      "type": "title",
      "content": []
    }
  ]
}

Slide types allowed:
- title
- agenda
- content
- comparison
- timeline
- process
- architecture
- diagram
- table
- statistics
- conclusion
- thankyou

Rules:

• Generate between 8 and 12 slides.

• The first slide MUST be a title slide.

• The second slide MUST be an agenda.

• The last slide MUST be a conclusion or thank you slide.

For every content slide:

{
  "title": "",
  "type": "content",
  "content": [
      "...",
      "...",
      "...",
      "...",
      "..."
  ],
  "notes": ""
}

Each content array should contain 4-7 concise bullet points.

Keep every bullet under 18 words.

Use professional presentation language.

Avoid repeating ideas.

If the topic is technical:
- explain concepts
- include workflow
- architecture
- advantages
- disadvantages
- best practices
- real-world applications

If the topic is educational:
- begin with introduction
- explain concepts progressively
- provide examples
- summarize key takeaways

If the topic is business:
- include market insights
- opportunities
- risks
- recommendations

For comparisons use:

{
  "title":"",
  "type":"comparison",
  "leftTitle":"",
  "rightTitle":"",
  "left":[...],
  "right":[...]
}

For timelines:

{
  "title":"",
  "type":"timeline",
  "events":[
      {
        "year":"",
        "title":"",
        "description":""
      }
  ]
}

For process diagrams:

{
  "title":"",
  "type":"process",
  "steps":[
      "...",
      "...",
      "...",
      "..."
  ]
}

For tables:

{
  "title":"",
  "type":"table",
  "headers":["","",""],
  "rows":[
      ["","",""],
      ["","",""]
  ]
}

For statistics:

{
  "title":"",
  "type":"statistics",
  "items":[
      {
        "label":"",
        "value":"",
        "description":""
      }
  ]
}

Output must be presentation-ready.

Every slide should naturally flow into the next.

Topic:

${state.prompt}
`;

    const res = await llm.invoke(prompt)

    await deductCredits(state.userId, "ppt")

    const data = JSON.parse(res.content)

    const ppt = await generatePpt(data)

    const buffer = await ppt.write({
      outputType: "nodebuffer"
    })

    const filename = `ppt-${Date.now()}.pptx`

    await uploadToS3(filename, buffer, "application/vnd.openxmlformats-officedocument.presentationml.presentation")

    const downloadUrl = await getFromS3(filename, 48 * 60 * 60);

    return {
      ...state,
      aiResponse: `
        # 💹 presentation Generated
        ** ${data.title} **
          👇 [downaod PPt](${downloadUrl})

          _Link expires in 10 minutes._
        `
    }

  } catch (error) {
    console.log(error)
    return {
      ...state,
      aiResponse: "Failed to Generate ppt"
    }
  }
}