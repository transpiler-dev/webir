import fs from "fs";
import path from "path";

function toSnake(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

function toPascalCase(name: string): string {
  return toSnake(name)
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// Helper: map simple JS types to Gleam types
function mapType(jsType: string): string {
  switch (jsType) {
    case "string": return "String";
    case "boolean": return "Bool";
    case "number":
    case "float":
    case "double": return "Float";
    case "void": return "Nil";
    case "any":
    case "unknown":
    default: return "JsUnknown";
  }
}

function getAllAncestors(name: string, extendsMap: Record<string, string[]>): string[] {
  const out = new Set<string>();
  const stack = [...(extendsMap[name] ?? [])];
  while (stack.length > 0) {
    const next = stack.pop()!;
    if (!out.has(next)) {
      out.add(next);
      for (const parent of extendsMap[next] ?? []) stack.push(parent);
    }
  }
  return [...out];
}

function getMergedEntries(
  name: string,
  ir: Record<string, any[]>,
  extendsMap: Record<string, string[]>
): any[] {
  const all = new Map<string, any>();
  for (const iface of [name, ...getAllAncestors(name, extendsMap)]) {
    for (const entry of ir[iface] ?? []) {
      if (!all.has(entry.name)) all.set(entry.name, entry); // first match wins
    }
  }
  return [...all.values()];
}

function emitInterfaceModule(name: string, entries: any[], outDir: string) {
  const snakeCaseName = toSnake(name);
  const pascalCaseName = toPascalCase(name);
  const filename = path.join(outDir, "src", `${snakeCaseName}.gleam`);
  const lines: string[] = [
    `// Generated from DOM interface: ${name}`,
    "",
    "import webir/js_ref.{JsRef, JsUnknown}",
    "import webir/upcast",
    "",
    `pub type ${pascalCaseName}`,
    ""
  ];

  for (const entry of entries) {
    const fnName = toSnake(entry.name)
    const doc = entry.doc ? `/// ${entry.doc}` : "";

    if (entry.kind === "method") {
      const params = (entry.parameters ?? []).map((p: any) =>
        `${p.name}: ${mapType(p.type)}`
      );
      lines.push(doc);
      lines.push(`@external(javascript, "${name}.${entry.name}", "${fnName}")`);
      lines.push(`pub fn ${fnName}(el: JsRef(${snakeCaseName})${params.length ? `, ${params.join(", ")}` : ""}) -> ${mapType(entry.returnType)}`);
      lines.push("");
    }

    if (entry.kind === "property") {
      lines.push(doc);
      lines.push(`@external(javascript, "${name}.${entry.name}", "${fnName}")`);
      lines.push(`pub fn ${fnName}(el: JsRef(${snakeCaseName})) -> ${mapType(entry.type)}`);
      lines.push("");
    }

    if (entry.kind === "event") {
      lines.push(doc);
      lines.push(`/// Registers a '${entry.name}' event`);
      lines.push(`pub fn ${fnName}(el: JsRef(${snakeCaseName}), cb: JsUnknown) -> Nil {`);
      lines.push(`  event.add_event_listener(el, "${entry.name}", cb)`);
      lines.push("}");
      lines.push("");
    }
  }

  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, lines.join("\n"), "utf-8");
  console.log(`✅ Emitted: ${filename}`);
}

function emitUpcasts(ir: Record<string, any[]>, extendsMap: Record<string, string[]>, outDir: string) {
  const upcasts: string[] = ["import webir/js_ref.{JsRef}", ""];
  for (const subtype of Object.keys(ir)) {
    for (const supertype of getAllAncestors(subtype, extendsMap)) {
      const name = `as_${supertype.toLowerCase()}`;
      upcasts.push(`pub fn ${name}(el: JsRef(${subtype})) -> JsRef(${supertype}) {`);
      upcasts.push("  JsRef(el.0)");
      upcasts.push("}");
      upcasts.push("");
    }
  }

  const pathOut = path.join(outDir, "src", "upcast.gleam");
  fs.mkdirSync(path.dirname(pathOut), { recursive: true });
  fs.writeFileSync(pathOut, upcasts.join("\n"), "utf-8");
  console.log(`✅ Emitted: ${pathOut}`);
}

function emitFlatTwigModule(ir: Record<string, any[]>, outDir: string) {
  const uses: string[] = [];
  for (const iface of Object.keys(ir)) {
    if (iface === "__extends__") continue;
    uses.push(`pub use ${iface.toLowerCase()}.{\n  ${[...new Set((ir[iface] ?? []).map(e => e.name.replace(/([A-Z])/g, "_$1").toLowerCase()))].join(",\n  ")}\n}`);
  }
  uses.push("pub use upcast.{\n  " + Object.keys(ir)
    .filter(k => k !== "__extends__")
    .flatMap(k => getAllAncestors(k, ir.__extends__ ?? []).map(a => `as_${a.toLowerCase()}`))
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(",\n  ") + "\n}");

  const pathOut = path.join(outDir, "src", "twig.gleam");
  fs.mkdirSync(path.dirname(pathOut), { recursive: true });
  fs.writeFileSync(pathOut, uses.join("\n\n"), "utf-8");
  console.log(`✅ Emitted: ${pathOut}`);
}

export function emitGleamBindings(ir: Record<string, any[]>, outDir: string) {
  const extendsMap = ir.__extends__ ?? {};

  for (const iface of Object.keys(ir)) {
    if (iface === "__extends__") continue;
    const entries = getMergedEntries(iface, ir, extendsMap);
    emitInterfaceModule(iface, entries, outDir);
  }

  emitUpcasts(ir, extendsMap, outDir);
  emitFlatTwigModule(ir, outDir);
}

