import { Project, SyntaxKind } from "ts-morph";

export interface DomApiIR {
  ir: Record<string, any[]>;
  interfaceNames: string[];
  extendsMap: Record<string, string[]>;
}

export function extractDomApiIR(): DomApiIR {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(
    "node_modules/typescript/lib/lib.dom.d.ts"
  );

  const result: Record<string, any[]> = {};
  const extendsMap: Record<string, string[]> = {};

  for (const iface of sourceFile.getInterfaces()) {
    const ifaceName = iface.getName();
    const entries: any[] = [];

    // Record interface inheritance
    const baseTypes = iface.getExtends().map(ext => ext.getText());
    if (baseTypes.length > 0) {
      extendsMap[ifaceName] = baseTypes;
    }

    for (const member of iface.getMembers()) {
      if (
        member.getKind() !== SyntaxKind.MethodSignature &&
        member.getKind() !== SyntaxKind.PropertySignature
      ) continue;

      const name = (member as any).getName?.();
      const jsDoc = member.getJsDocs().map(doc => doc.getComment()).filter(Boolean).join("\n");

      if (member.getKind() === SyntaxKind.MethodSignature) {
        const methodSig = member.asKind(SyntaxKind.MethodSignature);

        const parameters = methodSig?.getParameters().map(p => ({
          name: p.getName(),
          type: p.getType().getText(),
          optional: p.isOptional(),
          rest: p.isRestParameter()
        })) || [];

        const returnType = methodSig?.getReturnType().getText() || "unknown";
        const arity = parameters.length;
        const required = parameters.filter(p => !p.optional).length;

        // Extract `this` type from signature declaration
        const callSignatures = methodSig?.getType().getCallSignatures() || [];
        const thisTypes = callSignatures
          .map(sig => {
            const decl = sig.getDeclaration();
            const thisParam = decl.getThisParameter?.();
            return thisParam ? thisParam.getType().getText() : undefined;
          })
          .filter(Boolean);

        const thisType = thisTypes.length > 0 ? thisTypes[0] : undefined;

        entries.push({
          interface: ifaceName,
          kind: "method",
          name,
          parameters,
          arity,
          required,
          returnType,
          thisType,
          doc: jsDoc || undefined,
        });

      } else if (member.getKind() === SyntaxKind.PropertySignature) {
        const propSig = member.asKind(SyntaxKind.PropertySignature);
        const propType = propSig?.getType().getText() || "unknown";

        const isEvent = /^on\w+/.test(name ?? "");

        entries.push({
          interface: ifaceName,
          kind: isEvent ? "event" : "property",
          name,
          type: propType,
          doc: jsDoc || undefined,
        });
      }
    }

    if (entries.length > 0) {
      result[ifaceName] = entries;
    }
  }

  return {
    ir: result,
    interfaceNames: Object.keys(result),
    extendsMap
  };
}
