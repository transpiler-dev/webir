#!/usr/bin/env node
const ts = require('typescript');
const path = require('path');

function extract() {
  const libPath = path.join(path.dirname(require.resolve('typescript')), 'lib', 'lib.dom.d.ts');
  const program = ts.createProgram([libPath], {});
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(libPath);
  const result = {};
  const interfaceNames = [];

  function visit(node) {
    if (ts.isInterfaceDeclaration(node)) {
      const ifaceName = node.name.text;
      interfaceNames.push(ifaceName);
      const entries = [];
      for (const member of node.members) {
        const docs = ts.getJSDocCommentsAndTags(member).map(d => d.getText()).join('\n');
        const doc = docs.trim() || undefined;
        if (ts.isMethodSignature(member)) {
          const parameters = member.parameters.map(p => ({
            name: p.name.getText(),
            type: p.type ? p.type.getText() : 'any',
            optional: !!p.questionToken,
            rest: !!p.dotDotDotToken
          }));
          const returnType = member.type ? member.type.getText() : 'void';
          const arity = parameters.length;
          const required = parameters.filter(p => !p.optional).length;

          let thisType;
          const type = checker.getTypeAtLocation(member);
          for (const sig of type.getCallSignatures()) {
            const decl = sig.getDeclaration();
            const thisParam = decl.thisParameter;
            if (thisParam) {
              thisType = checker.typeToString(checker.getTypeOfSymbolAtLocation(thisParam, thisParam.valueDeclaration));
              break;
            }
          }
          entries.push({ interface: ifaceName, kind: 'method', name: member.name.getText(), parameters, arity, required, returnType, thisType, doc });
        } else if (ts.isPropertySignature(member)) {
          const name = member.name.getText();
          const type = member.type ? member.type.getText() : 'any';
          const isEvent = /^on\w+/i.test(name);
          entries.push({ interface: ifaceName, kind: isEvent ? 'event' : 'property', name, type, doc });
        }
      }
      if (entries.length > 0) result[ifaceName] = entries;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { ir: result, interfaceNames };
}

const data = extract();
process.stdout.write(JSON.stringify(data));
