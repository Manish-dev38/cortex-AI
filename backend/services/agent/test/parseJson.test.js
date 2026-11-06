import test from "node:test";
import assert from "node:assert/strict";
import { parseJsonFromLlm } from "../utils/parseJson.js";

test("parseJsonFromLlm", async (t) => {
    await t.test("parses a plain JSON object", () => {
        assert.deepEqual(parseJsonFromLlm('{"files":[{"name":"a.html","content":"x"}]}'), {
            files: [{ name: "a.html", content: "x" }],
        });
    });

    await t.test("parses a fenced JSON block", () => {
        const raw = "```json\n{\"title\":\"Hello\"}\n```";
        assert.deepEqual(parseJsonFromLlm(raw), { title: "Hello" });
    });

    await t.test("extracts JSON surrounded by prose", () => {
        const raw = "Sure, here you go:\n{\"sections\":[]}\nHope that helps.";
        assert.deepEqual(parseJsonFromLlm(raw), { sections: [] });
    });

    await t.test("ignores a leading brace inside the fence language", () => {
        const raw = "```\n{\"a\":1}\n```";
        assert.deepEqual(parseJsonFromLlm(raw), { a: 1 });
    });

    await t.test("rejects an empty response", () => {
        assert.throws(() => parseJsonFromLlm("   "), /empty response/i);
    });

    await t.test("rejects a response without an object", () => {
        assert.throws(() => parseJsonFromLlm("no json here"), /does not contain a JSON object/i);
    });

    await t.test("rejects malformed JSON", () => {
        assert.throws(() => parseJsonFromLlm('{"a": }'));
    });
});
