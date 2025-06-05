#!/usr/bin/env bun
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { runExtract } from "./extract";
import { runListInterfaces } from "./interfaces";

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
  .demandCommand()
  .help()
  .parse();
