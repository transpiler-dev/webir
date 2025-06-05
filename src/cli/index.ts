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
  .demandCommand()
  .help()
  .parse();
