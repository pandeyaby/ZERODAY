# Tree-sitter grammars

Prebuilt WebAssembly grammars used by the `locate --rules` engine
(`src/locate/engine`), loaded with [`web-tree-sitter`](https://www.npmjs.com/package/web-tree-sitter).
Copied unmodified from the official grammar packages on npm; each is MIT-licensed
(see the `LICENSE-*` file next to it).

| File | Package |
|------|---------|
| `tree-sitter-javascript.wasm` | `tree-sitter-javascript@0.25.0` |
| `tree-sitter-typescript.wasm`, `tree-sitter-tsx.wasm` | `tree-sitter-typescript@0.23.2` |
| `tree-sitter-python.wasm` | `tree-sitter-python@0.25.0` |
| `tree-sitter-java.wasm` | `tree-sitter-java@0.23.5` |
| `tree-sitter-go.wasm` | `tree-sitter-go@0.25.0` |

To update: `npm pack tree-sitter-<lang>@<version>`, copy the `.wasm` and `LICENSE`
from the tarball, update this table, and run `npm test`.
