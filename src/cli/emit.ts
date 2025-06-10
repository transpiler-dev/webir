import fs from "fs";
import path from "path";
import { extractDomApiIR } from "../lib/extractor";
import { validateIR } from "../lib/validator";
import { emitGleamBindings } from "../lib/emit-gleam";

export async function runEmit(language: string, options: { irFile?: string, output?: string }) {
  if (language !== "gleam") {
    console.error(`❌ Unsupported language: ${language}`);
    process.exit(1);
  }

  let irData;

  if (options.irFile) {
    const content = fs.readFileSync(options.irFile, "utf-8");
    irData = JSON.parse(content);
  } else {
    const { ir, extendsMap } = extractDomApiIR();
    irData = { ...ir, __extends__: extendsMap };
  }

  const { valid, errors } = validateIR(irData);
  if (!valid) {
    console.error("❌ IR is invalid. Aborting emit.");
    console.error(errors);
    process.exit(1);
  }

  const outputDir = options.output ?? "bindings/gleam/twig";
  emitGleamBindings(irData, outputDir);
}
