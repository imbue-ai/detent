// Vendored stub: detent always passes already-tokenized argv to `parse()`,
// so the Bash tokenizer (which normally pulls in tree-sitter + tree-sitter-bash,
// native modules that break `bun build --compile`) is never reached.
// We keep the export surface so `parse.js` can still `import { tokenize }`.
import { CCError } from "../utils.js";

export function tokenize(_curlCommand, _warnings) {
    throw new CCError(
        "shell tokenization is not supported in the vendored curlconverter subset; " +
        "pass an argv array to parse() instead of a shell command string"
    );
}
