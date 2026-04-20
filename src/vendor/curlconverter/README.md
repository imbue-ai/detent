# Vendored curlconverter subset

This directory contains a minimal subset of
[curlconverter](https://github.com/curlconverter/curlconverter) (MIT license,
see `LICENSE`). It is vendored verbatim from `curlconverter@4.12.0`'s compiled
`dist/src/` output, with one modification:

- `shell/tokenizer.js` is replaced with a stub that throws if called. The real
  tokenizer depends on `tree-sitter` and `tree-sitter-bash`, native modules that
  break `bun build --compile` and inflate the install footprint considerably.
  detent only ever feeds `parse()` an already-tokenized argv array, so the
  tokenizer code path is never exercised.

## Why vendor instead of depending on curlconverter?

- curlconverter is a code-generation tool for ~50 target languages; detent only
  uses its curl argument parser (via the HAR generator).
- The full package eagerly imports the Bash tokenizer at module load time, which
  pulls native dependencies into any bundle that references it.
- We need the parser's full flag coverage (security-relevant: every flag that
  silently drops is a flag that can smuggle headers/bodies past permission
  checks), so the smaller pure-JS curl parsers on npm are not an adequate
  replacement.

Vendoring gives us curlconverter's full curl-flag fidelity with zero native
dependencies and no eager code-generator imports.

## Updating

When updating, re-copy the files below from a fresh `curlconverter` install and
reapply the tokenizer stub:

```
utils.{js,d.ts}
Headers.{js,d.ts}
Query.{js,d.ts}
Warnings.{js,d.ts}
parse.{js,d.ts}
Request.{js,d.ts}
curl/form.{js,d.ts}
curl/opts.{js,d.ts}
curl/url.{js,d.ts}
curl/auth.{js,d.ts}
shell/Word.{js,d.ts}
generators/har.{js,d.ts}
```

Do not copy `shell/tokenizer.{js,d.ts}` or anything under `shell/Parser.*`,
`shell/webParser.*`, or any of the other `generators/*` files.
