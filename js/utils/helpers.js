/**
 * @file A collection of small, reusable utility functions used across different modules.
 */

/**
 * Normalizes a string or number to a consistent lowercase, trimmed string format for reliable matching.
 * @param {string|number} id The ID to normalize.
 * @returns {string} The normalized ID.
 */
function normalizeId(id) {
    if (id === null || id === undefined) return '';
    return String(id).trim().toLowerCase();
}

/**
 * Checks if a value is null, undefined, or an empty/whitespace-only string.
 * @param {*} value The value to check.
 * @returns {boolean} True if the value is considered blank or empty.
 */
function isBlankOrEmpty(value) {
    return value === null || value === undefined || String(value).trim() === '';
}

/**
 * Wraps a string of text to fit within a given width in an SVG text element.
 * It automatically handles line breaks and adds an ellipsis if the text exceeds the max lines.
 * @param {d3.Selection} textElement The D3 selection of the text element to wrap.
 * @param {string} text The text content to wrap.
 * @param {number} width The maximum width for each line.
 * @param {number} [maxLines=2] The maximum number of lines to render.
 * @param {number} [startY=0] The initial y-coordinate for the first line of text.
 */
function wrapSVGText(textElement, text, width, maxLines = 2, startY = 0) {
    if (!text) return;
    textElement.text(null);
    const words = text.toString().split(/\s+/);
    let line = [];
    let lineNumber = 0;
    const lineHeight = 1.2; // ems
    let tspan = textElement.append("tspan").attr("x", 0).attr("y", startY);

    for (let i = 0; i < words.length; i++) {
        line.push(words[i]);
        tspan.text(line.join(" "));
        if (tspan.node().getComputedTextLength() > width && line.length > 1) {
            line.pop();
            tspan.text(line.join(" "));
            lineNumber++;
            if (lineNumber >= maxLines) {
                tspan.text(tspan.text() + "...");
                return;
            }
            line = [words[i]];
            tspan = textElement.append("tspan").attr("x", 0).attr("y", startY).attr("dy", `${lineNumber * lineHeight}em`).text(words[i]);
        }
    }
}

// Expose functions to global window object
window.normalizeId = normalizeId;
window.isBlankOrEmpty = isBlankOrEmpty;
window.wrapSVGText = wrapSVGText;
