package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sort"
	"strings"
)

// Structures mirroring the IR schema

type Parameter struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Optional bool   `json:"optional"`
	Rest     bool   `json:"rest"`
}

type MethodEntry struct {
	Interface  string      `json:"interface"`
	Kind       string      `json:"kind"`
	Name       string      `json:"name"`
	Parameters []Parameter `json:"parameters"`
	Arity      int         `json:"arity"`
	Required   int         `json:"required"`
	ReturnType string      `json:"returnType"`
	ThisType   string      `json:"thisType,omitempty"`
	Doc        string      `json:"doc,omitempty"`
}

type PropertyEntry struct {
	Interface string `json:"interface"`
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Type      string `json:"type"`
	Doc       string `json:"doc,omitempty"`
}

type Extraction struct {
	IR             map[string][]json.RawMessage `json:"ir"`
	InterfaceNames []string                     `json:"interfaceNames"`
}

func runNodeExtraction() (*Extraction, error) {
	cmd := exec.Command("node", "scripts/extract.js")
	if os.Getenv("NODE_PATH") == "" {
		if out, err := exec.Command("npm", "root", "-g").Output(); err == nil {
			nodePath := strings.TrimSpace(string(out))
			cmd.Env = append(os.Environ(), "NODE_PATH="+nodePath)
		}
	}
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	var res Extraction
	if err := json.Unmarshal(out, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func cmdExtract(args []string) error {
	fs := flag.NewFlagSet("extract", flag.ExitOnError)
	outPath := fs.String("output", "", "file path to write output")
	fs.StringVar(outPath, "o", "", "file path to write output")
	if err := fs.Parse(args); err != nil {
		return err
	}
	selected := fs.Args()
	data, err := runNodeExtraction()
	if err != nil {
		return err
	}
	ir := map[string][]json.RawMessage{}
	if len(selected) > 0 {
		for _, name := range selected {
			if v, ok := data.IR[name]; ok {
				ir[name] = v
			}
		}
	} else {
		ir = data.IR
	}
	jsonBytes, err := json.MarshalIndent(ir, "", "  ")
	if err != nil {
		return err
	}
	if *outPath != "" {
		if err := os.WriteFile(*outPath, jsonBytes, 0644); err != nil {
			return err
		}
		fmt.Printf("✅ IR written to %s\n", *outPath)
	} else {
		fmt.Println(string(jsonBytes))
	}
	return nil
}

func cmdInterfaces(args []string) error {
	fs := flag.NewFlagSet("interfaces", flag.ExitOnError)
	if err := fs.Parse(args); err != nil {
		return err
	}
	data, err := runNodeExtraction()
	if err != nil {
		return err
	}
	names := append([]string(nil), data.InterfaceNames...)
	sort.Strings(names)
	for _, n := range names {
		fmt.Println(n)
	}
	return nil
}

func validateEntry(m map[string]interface{}) error {
	kind, ok := m["kind"].(string)
	if !ok {
		return errors.New("missing kind")
	}
	iface, ok := m["interface"].(string)
	if !ok || iface == "" {
		return errors.New("missing interface")
	}
	name, ok := m["name"].(string)
	if !ok || name == "" {
		return errors.New("missing name")
	}
	switch kind {
	case "method":
		if _, ok := m["returnType"].(string); !ok {
			return errors.New("missing returnType")
		}
		params, ok := m["parameters"].([]interface{})
		if !ok {
			return errors.New("missing parameters")
		}
		for _, p := range params {
			pm, ok := p.(map[string]interface{})
			if !ok {
				return errors.New("invalid parameter")
			}
			if _, ok := pm["name"].(string); !ok {
				return errors.New("parameter missing name")
			}
			if _, ok := pm["type"].(string); !ok {
				return errors.New("parameter missing type")
			}
		}
	case "property", "event":
		if _, ok := m["type"].(string); !ok {
			return errors.New("missing type")
		}
	default:
		return fmt.Errorf("unknown kind %s", kind)
	}
	return nil
}

func validateIR(r io.Reader) error {
	var data map[string][]interface{}
	dec := json.NewDecoder(r)
	dec.UseNumber()
	if err := dec.Decode(&data); err != nil {
		return err
	}
	for k, v := range data {
		if !strings.HasPrefix(k, "") { // just to use k
		}
		for _, item := range v {
			m, ok := item.(map[string]interface{})
			if !ok {
				return errors.New("invalid entry")
			}
			if err := validateEntry(m); err != nil {
				return fmt.Errorf("%s: %w", k, err)
			}
		}
	}
	return nil
}

func cmdValidate(args []string) error {
	fs := flag.NewFlagSet("validate", flag.ExitOnError)
	inFile := fs.String("in", "", "input JSON file (defaults to stdin)")
	fs.StringVar(inFile, "i", "", "input JSON file (defaults to stdin)")
	if err := fs.Parse(args); err != nil {
		return err
	}
	var r io.Reader = os.Stdin
	if *inFile != "" && *inFile != "-" {
		f, err := os.Open(*inFile)
		if err != nil {
			return err
		}
		defer f.Close()
		r = f
	}
	if err := validateIR(r); err != nil {
		fmt.Println("❌ Schema validation failed")
		return err
	}
	fmt.Println("✅ Schema validation passed")
	return nil
}

func usage() {
	fmt.Println("Usage: webir <command> [options]")
	fmt.Println("Commands: extract, interfaces, validate")
}

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}
	cmd := os.Args[1]
	var err error
	switch cmd {
	case "extract":
		err = cmdExtract(os.Args[2:])
	case "interfaces":
		err = cmdInterfaces(os.Args[2:])
	case "validate":
		err = cmdValidate(os.Args[2:])
	default:
		usage()
		os.Exit(1)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
