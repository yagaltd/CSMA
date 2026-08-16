/**
 * MentionParser — parses @mentions from text bodies.
 * Pure function, no dependencies.
 *
 * Vendored copy of src/modules/mentions/services/MentionParser.js
 * (module-boundary rule: modules do not import modules; the parser is
 * self-contained so the copy is verbatim). Delta from source: none.
 * See src/modules/visual-editor/README.md.
 */
export class MentionParser {
    /**
     * Parse mentions from a text body.
     * @param {string} text
     * @returns {Array<{ type: string, id: string|null, raw: string, start: number, end: number }>}
     */
    parse(text) {
        if (!text || typeof text !== 'string') return [];
        const mentions = [];
        const re = /@([a-z][a-z0-9_-]*)(?::([a-z][a-z0-9._-]*))?\b/gi;
        let m;
        while ((m = re.exec(text)) !== null) {
            mentions.push({
                type: m[1],
                id: m[2] || null,
                raw: m[0],
                start: m.index,
                end: m.index + m[0].length
            });
        }
        return mentions;
    }
}
