import fs from "fs";
import readline from "readline";

const rl = readline.createInterface({
  input: fs.createReadStream("/home/bendo/.gemini/antigravity-ide/brain/5ea27e33-b051-4ea0-a152-f3e5191754f9/.system_generated/logs/transcript.jsonl")
});

rl.on("line", (line) => {
  if (line.includes("replace_file_content") && line.includes("api_v1.ts")) {
    try {
      const obj = JSON.parse(line);
      // Check if this is a tool call
      const toolCalls = obj.tool_calls || [];
      toolCalls.forEach(tc => {
        if (tc.name === "replace_file_content" && tc.args.TargetFile.includes("api_v1.ts")) {
          console.log("\n=================== EDIT MATCH ===================");
          console.log("Instruction:", tc.args.Instruction);
          console.log("StartLine:", tc.args.StartLine, "EndLine:", tc.args.EndLine);
          console.log("TargetContent:\n", tc.args.TargetContent);
          console.log("ReplacementContent:\n", tc.args.ReplacementContent);
        }
      });
    } catch (e) {
      // Ignored
    }
  }
});
