/**
 * Extracts class and stream from an email like "senior5p@scienceclublss.me".
 * Returns { class: string, stream: string } or null if not matching.
 */
function extractClassAndStream(
    email
) {
    const match = /^senior(\d+)([a-zA-Z])@/.exec(email);
    if (!match) return null;
    return { class: match[1], stream: match[2] };
}

// Example usage:
const result = extractClassAndStream("senior5p@scienceclublss.me");
console.log(result);
// result: { class: "5", stream: "p" }
