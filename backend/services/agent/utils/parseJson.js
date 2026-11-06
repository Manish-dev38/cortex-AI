/**
 * LLM output is not a transport: it arrives wrapped in fences, prefixed with
 * prose, or truncated. Extract the outermost JSON object before parsing.
 */
export function parseJsonFromLlm(raw) {
    if (typeof raw !== "string" || raw.trim().length === 0) {
        throw new Error("Model returned an empty response")
    }

    let text = raw.trim();

    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        text = fenced[1].trim();
    }

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) {
        throw new Error("Model response does not contain a JSON object")
    }

    return JSON.parse(text.slice(start, end + 1));
}
