import { readFileSync } from "fs";
import Ajv2020 from "ajv/dist/2020";
import schema from "../../resources/ir.schema.json" assert { type: "json" };

export function runValidate(file?: string) {
  const input = file && file !== "-" ? readFileSync(file, "utf-8") : readFileSync(0, "utf-8");
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
