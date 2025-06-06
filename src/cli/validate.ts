import { readFileSync } from "fs";
import Ajv2020 from "ajv/dist/2020";
import schema from "../../resources/ir.schema.json" assert { type: "json" };

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
  const ajv = new Ajv2020({ allErrors: true });
  const validate = ajv.compile(schema);
  const valid = validate(json);
  if (valid) {
    console.log("✅ Schema validation passed");
  } else {
    console.error("❌ Schema validation failed");
    console.error(validate.errors);
    process.exit(1);
  }
}
