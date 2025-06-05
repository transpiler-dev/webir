import { extractDomApiIR } from "../lib/extractor";

export function runListInterfaces() {
  const { interfaceNames } = extractDomApiIR();
  for (const name of interfaceNames.sort()) {
    console.log(name);
  }
}
