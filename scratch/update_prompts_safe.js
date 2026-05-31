import fs from "fs";
import path from "path";

const filePath = path.resolve("src/backend/api_v1.ts");
console.log("Reading file:", filePath);
let originalContent = fs.readFileSync(filePath, "utf8");

// Normalize file content line breaks
let content = originalContent.replace(/\r\n/g, "\n");

// Target: subjectMatch regex
const t7 = `  const subjectMatch = subject ? subject.match(/\\[STALLY RFQ-((?:case|rfq)-[a-z0-9-]+)\\]/i) : null;`.replace(/\r\n/g, "\n");
const r7 = `  const subjectMatch = subject ? subject.match(/\\[STALLY (?:RFQ|NEGOTIATION)-((?:case|rfq)-[a-z0-9-]+)\\]/i) : null;`.replace(/\r\n/g, "\n");

if (content.includes(t7)) {
  content = content.replace(t7, r7);
  console.log("✓ Replacement 7 (Update subjectMatch regex) succeeded!");
} else {
  console.error("✗ Replacement 7 failed: Target not found");
}

// Restore CRLF if original file had them
if (originalContent.includes("\r\n")) {
  content = content.replace(/\n/g, "\r\n");
}

fs.writeFileSync(filePath, content, "utf8");
console.log("All modifications completed successfully!");
