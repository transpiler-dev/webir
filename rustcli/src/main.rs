use clap::{Parser, Subcommand};
use std::path::PathBuf;
use std::fs;
use std::collections::BTreeMap;
use serde::Serialize;
use swc_common::{SourceMap, sync::Lrc};
use swc_ecma_parser::{Parser as SwcParser, Syntax, TsConfig, EsConfig, lexer::Lexer, StringInput};
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};
use jsonschema::{JSONSchema};

#[derive(Parser)]
#[command(name = "webir", about = "DOM API IR generator rewritten in Rust")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Extract {
        #[arg()] interfaces: Vec<String>,
        #[arg(short, long)] output: Option<PathBuf>,
    },
    Interfaces,
    Validate {
        #[arg(short, long, value_name="FILE")] input: Option<PathBuf>,
        #[arg(value_name="FILE")] file: Option<PathBuf>,
    },
}

#[derive(Serialize)]
struct Parameter {
    name: String,
    #[serde(rename="type")]
    type_: String,
    optional: bool,
    rest: bool,
}

#[derive(Serialize)]
#[serde(tag="kind")]
enum IrEntry {
    #[serde(rename="method")]
    Method {
        interface: String,
        name: String,
        parameters: Vec<Parameter>,
        arity: usize,
        required: usize,
        returnType: String,
        #[serde(skip_serializing_if="Option::is_none")]
        thisType: Option<String>,
        #[serde(skip_serializing_if="Option::is_none")]
        doc: Option<String>,
    },
    #[serde(rename="property")]
    Property {
        interface: String,
        name: String,
        #[serde(rename="type")]
        type_: String,
        #[serde(skip_serializing_if="Option::is_none")]
        doc: Option<String>,
    },
    #[serde(rename="event")]
    Event {
        interface: String,
        name: String,
        #[serde(rename="type")]
        type_: String,
        #[serde(skip_serializing_if="Option::is_none")]
        doc: Option<String>,
    }
}

#[derive(Default)]
struct ExtractVisitor {
    current_iface: Option<String>,
    result: BTreeMap<String, Vec<IrEntry>>,    
}

impl Visit for ExtractVisitor {
    fn visit_ts_interface_decl(&mut self, n: &TsInterfaceDecl) {
        let name = n.id.sym.to_string();
        self.current_iface = Some(name.clone());
        n.body.visit_with(self);
        self.current_iface = None;
    }

    fn visit_ts_property_signature(&mut self, n: &TsPropertySignature) {
        if let Some(ref iface) = self.current_iface {
            if let Some(ident) = n.key.as_ident() {
                let name = ident.sym.to_string();
                let ty = type_to_string(n.type_annotation.as_ref().map(|t| &*t.type_ann));
                let is_event = name.starts_with("on");
                let entry = if is_event {
                    IrEntry::Event { interface: iface.clone(), name, type_: ty, doc: None }
                } else {
                    IrEntry::Property { interface: iface.clone(), name, type_: ty, doc: None }
                };
                self.result.entry(iface.clone()).or_default().push(entry);
            }
        }
    }

    fn visit_ts_method_signature(&mut self, n: &TsMethodSignature) {
        if let Some(ref iface) = self.current_iface {
            if let Some(ident) = n.key.as_ident() {
                let name = ident.sym.to_string();
                let mut params = Vec::new();
                for p in &n.params {
                    match p {
                        TsFnParam::Ident(b) => {
                            params.push(Parameter{
                                name: b.id.sym.to_string(),
                                type_: type_to_string(b.type_ann.as_ref().map(|t| &*t.type_ann)),
                                optional: b.optional,
                                rest: false,
                            });
                        }
                        TsFnParam::Rest(r) => {
                            if let TsFnParam::Ident(b) = &*r.arg {
                                params.push(Parameter{
                                    name: b.id.sym.to_string(),
                                    type_: type_to_string(b.type_ann.as_ref().map(|t| &*t.type_ann)),
                                    optional: b.optional,
                                    rest: true,
                                });
                            }
                        }
                        _ => {}
                    }
                }
                let arity = params.len();
                let required = params.iter().filter(|p| !p.optional).count();
                let return_type = type_to_string(n.type_ann.as_ref().map(|t| &*t.type_ann));
                let entry = IrEntry::Method {
                    interface: iface.clone(),
                    name,
                    parameters: params,
                    arity,
                    required,
                    returnType: return_type,
                    thisType: None,
                    doc: None,
                };
                self.result.entry(iface.clone()).or_default().push(entry);
            }
        }
    }
}

fn type_to_string(ty: Option<&Type>) -> String {
    match ty {
        Some(Type::TsKeywordType(k)) => match k.kind {
            TsKeywordTypeKind::TsNumberKeyword => "number".to_string(),
            TsKeywordTypeKind::TsStringKeyword => "string".to_string(),
            TsKeywordTypeKind::TsBooleanKeyword => "boolean".to_string(),
            _ => "unknown".to_string(),
        },
        Some(Type::TsVoidKeyword(_)) => "void".to_string(),
        Some(Type::TsTypeRef(r)) => r.type_name.to_string(),
        _ => "unknown".to_string(),
    }
}

fn parse_dom() -> BTreeMap<String, Vec<IrEntry>> {
    let cm: Lrc<SourceMap> = Default::default();
    let dom_path = "node_modules/typescript/lib/lib.dom.d.ts";
    let src = fs::read_to_string(dom_path).expect("failed to read lib.dom.d.ts");
    let lexer = Lexer::new(
        Syntax::Typescript(TsConfig {
            tsx: false,
            dynamic_import: false,
            decorators: false,
            ..Default::default()
        }),
        EsConfig::default(),
        StringInput::new(&src, 0, 0),
        None,
    );
    let mut parser = SwcParser::new_from(lexer);
    let module = parser.parse_typescript_module().expect("failed to parse");

    let mut visitor = ExtractVisitor::default();
    module.visit_with(&mut visitor);
    visitor.result
}

fn cmd_extract(selected: Vec<String>, output: Option<PathBuf>) {
    let mut ir = parse_dom();
    if !selected.is_empty() {
        ir.retain(|k, _| selected.contains(k));
    }
    let json = serde_json::to_string_pretty(&ir).unwrap();
    if let Some(out) = output {
        fs::write(&out, json).expect("write failed");
        println!("✅ IR written to {}", out.display());
    } else {
        println!("{}", json);
    }
}

fn cmd_interfaces() {
    let ir = parse_dom();
    for name in ir.keys() {
        println!("{}", name);
    }
}

fn cmd_validate(file: Option<PathBuf>, input_flag: Option<PathBuf>) {
    let path = input_flag.or(file).expect("input file required");
    let data = fs::read_to_string(path).expect("read failed");
    let json: serde_json::Value = serde_json::from_str(&data).unwrap();
    let schema_str = include_str!("../resources/ir.schema.json");
    let schema_json: serde_json::Value = serde_json::from_str(schema_str).unwrap();
    let compiled = JSONSchema::compile(&schema_json).unwrap();
    if compiled.is_valid(&json) {
        println!("✅ Schema validation passed");
    } else {
        println!("❌ Schema validation failed");
        std::process::exit(1);
    }
}

fn main() {
    let cli = Cli::parse();
    match cli.command {
        Commands::Extract { interfaces, output } => cmd_extract(interfaces, output),
        Commands::Interfaces => cmd_interfaces(),
        Commands::Validate { input, file } => cmd_validate(file, input),
    }
}
