import { readFileSync } from "fs";
import { validateIR } from "../lib/validator";

export async function runValidate(file?: string) {
  let input = "";

  if (!file || file === "-") {
    if (process.stdin.isTTY) {
      console.error("No input provided");
      process.exit(1);
    }

    input = await new Promise<string>((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf-8");
      process.stdin.on("data", chunk => (data += chunk));
      process.stdin.on("end", () => resolve(data));
      process.stdin.on("error", reject);
    });
  } else {
    input = readFileSync(file, "utf-8");
  }

  const json = JSON.parse(input);
  const { valid, errors } = validateIR(json);

  if (valid) {
    console.log("✅ Schema validation passed");
  } else {
    console.error("❌ Schema validation failed");
    console.error(errors);
    process.exit(1);
  }
}
