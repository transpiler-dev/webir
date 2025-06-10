import Ajv2020 from "ajv/dist/2020";
import schema from "../../resources/ir.schema.json" assert { type: "json" };

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

export function validateIR(json: unknown): { valid: boolean; errors: unknown[] } {
  const valid = validate(json);
  return {
    valid,
    errors: validate.errors ?? [],
  };
}

