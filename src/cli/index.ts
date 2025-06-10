#!/usr/bin/env bun
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { runExtract } from "./extract";
import { runListInterfaces } from "./interfaces";
import { runValidate } from "./validate";

yargs(hideBin(process.argv))
  .command(
    "extract [interfaces..]",
    "Extract DOM API IR",
    (yargs) => {
      return yargs
        .positional("interfaces", {
          describe: "List of interfaces to extract (default: all)",
          type: "string",
        })
        .option("output", {
          alias: "o",
          type: "string",
          describe: "File path to write output",
        });
    },
    (argv) => {
      runExtract(argv.interfaces as string[] | undefined, argv.output);
    }
  )
  .command(
    "interfaces",
    "List all available interfaces",
    () => {},
    () => {
      runListInterfaces();
    }
  )
  .command(
    "validate [file]",
    "Validate an IR JSON file against the schema",
    (yargs) => {
      return yargs
        .positional("file", {
          describe: "IR JSON file to validate (defaults to stdin)",
          type: "string",
        })
        .option("in", {
          alias: "i",
          type: "string",
          describe: "Input JSON file to validate",
        });
    },
    (argv) => {
      runValidate((argv.in as string) || (argv.file as string | undefined));
    }
  )
  .command(
    "emit <language>",
    "Emit language bindings",
    (yargs) =>
      yargs
        .positional("language", {
          describe: "Language to emit (e.g., gleam)",
          type: "string",
        })
        .option("irFile", {
          type: "string",
          describe: "Path to an existing IR JSON file",
        })
        .option("output", {
          alias: "o",
          type: "string",
          describe: "Output directory for emitted bindings",
        }),
    (argv) => {
      import("./emit").then(({ runEmit }) => {
        runEmit(argv.language as string, {
          irFile: argv.irFile as string | undefined,
          output: argv.output as string | undefined,
        });
      });
    }
  )
  .demandCommand()
  .help()
  .parse();
