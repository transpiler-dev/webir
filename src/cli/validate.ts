import { readFileSync } from "fs";
import Ajv from "ajv";
import schema from "../../ir.schema.json" assert { type: "json" };

export function runValidate(file: string) {
  const json = JSON.parse(readFileSync(file, "utf-8"));
  const ajv = new Ajv({ allErrors: true });
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
