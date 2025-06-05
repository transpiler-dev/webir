# WebIR

**WebIR** is a DOM API introspection and intermediate representation generator. It extracts full metadata—including method signatures, types, and documentation—from the web platform's `lib.dom.d.ts` file and produces a structured, self-documenting IR.

> 💡 Ideal for building documentation tools, code generators, type bridges, or transpilers targeting browser environments.

---

## 🔧 Features

- 🧠 Extracts all interfaces from `lib.dom.d.ts` (not just `window`, `document`, etc.)
- ✍️ Captures method signatures, return types, properties, and event handlers
- 📘 Includes JSDoc documentation in the output
- 🧩 Emits clean, schema-consistent IR as JSON (YAML and others coming soon)
- ⚡ Fast TypeScript-based implementation using `ts-morph`

---

## 📦 Installation

### Using Bun

```bash
bun install
```

---

## 🚀 Usage

```bash
bun extract
```

This prints the full DOM API IR to the console.

> You can redirect it to a file if desired:

```bash
bun extract > dom-api-ir.json
```

You can validate any generated IR JSON file:

```bash
bun validate -i dom-api-ir.json
```
You can also pipe directly from another command:

```bash
bun extract | bun validate
```

---

## 🛠️ Output Format

Each interface maps to an array of entries:

[Schema](./resources/ir.schema.json)

Example:
```json
{
  "HTMLElement": [
    {
      "interface": "HTMLElement",
      "kind": "method",
      "name": "click",
      "parameters": [],
      "arity": 0,
      "required": 0,
      "returnType": "void",
      "thisType": "HTMLElement",
      "doc": "Simulates a mouse click on an element."
    },
    {
      "interface": "HTMLElement",
      "kind": "property",
      "name": "innerHTML",
      "type": "string",
      "doc": "Gets or sets the HTML syntax describing the element's descendants."
    },
    {
      "interface": "HTMLElement",
      "kind": "event",
      "name": "onclick",
      "type": "(this: GlobalEventHandlers, ev: MouseEvent) => any",
      "doc": "Fired when the element is clicked."
    }
  ]
}
```

---

## 🔮 Roadmap

- [x] Full IR extraction from `lib.dom.d.ts`
- [ ] CLI interface (`webir extract`, `webir emit`, `webir filter`)
- [ ] Output format options (JSON, YAML, Markdown)
- [ ] Filtering: by interface, kind, name, or regex
- [ ] Optional JSDoc summarizer or short/long mode
- [ ] Web-based browser viewer for IR

---

## 🤝 Contributing

PRs and ideas welcome! To get started:

```bash
bun install
bun run index.ts
```

Please open issues for bugs, feature requests, or architectural feedback.

---

## 📄 License

Eclipse Public License - v 2.0

---

## 🌐 Project Site

Coming soon: [https://transpiler.dev/webir](https://transpiler.dev/webir)

---

## 🧑‍💻 Maintainer

[Matt Laine](https://github.com/brain-fuel)
