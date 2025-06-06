import { extractDomApiIR } from "../lib/extractor";
import * as fs from "fs";

export function runExtract(selected: string[] | undefined, output?: string) {
  const { ir, interfaceNames, extendsMap } = extractDomApiIR();

  const filtered = selected && selected.length > 0
    ? Object.fromEntries(Object.entries(ir).filter(([k]) => selected.includes(k)))
    : ir;

  const finalOutput = {
    ...filtered,
    __extends__: extendsMap
  };

  const json = JSON.stringify(finalOutput, null, 2);

  if (output) {
    fs.writeFileSync(output, json, "utf-8");
    console.log(`✅ IR written to ${output}`);
  } else {
    console.log(json);
  }
}

