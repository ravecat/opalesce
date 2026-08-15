# JSON Schema plugin conformance corpus

Each directory under `cases/` is one self-contained plugin contract case:

```text
cases/<case-id>/
├── case.json
├── asyncapi.json
├── expected/
│   └── schemas.json
└── instances/
    ├── valid.json
    └── invalid.json
```

`case.json` declares the input filename, AsyncAPI version, feature tags, and expected outcome. A
successful case keeps the complete expected artifact tree under `expected/`; paths below that
directory are the artifact paths returned by Core. Optional instance expectations name files in
the local `instances/` directory and definitions in the generated bundle. An error case declares
the internal generation error code and source JSON Pointer instead of artifacts.

Successful cases run twice through the public Core pipeline with `jsonSchema()` installed. The
suite compares the complete returned artifact array to `expected/` by relative path and exact
contents, then applies any instance-validation expectations. This covers parsing, plugin wiring,
artifact collection, serialization, and determinism as one consumer-visible contract.

Some malformed or unsupported inputs cannot pass AsyncAPI parsing. Those error cases run at the
plugin's unresolved-source boundary so they verify plugin diagnostics instead of accidentally
asserting parser behavior. A separate focused integration test verifies Core's plugin-error
wrapping.

The loader discovers case directories automatically. It fails for non-directory entries under
`cases/`, missing inputs or expected artifacts, and files not owned by the local `case.json`.
Feature-tag checks keep the supported version and edge-case matrix explicit without multiplying
every independent feature into a full Cartesian product.
