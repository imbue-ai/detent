# Detent

[![npm](https://img.shields.io/npm/v/@imbue-ai/detent?style=flat-square)](https://npmjs.com/package/@imbue-ai/detent)
[![CI](https://img.shields.io/github/actions/workflow/status/imbue-ai/detent/ci.yml?style=flat-square)](https://github.com/imbue-ai/detent/actions)
[![license](https://img.shields.io/npm/l/@imbue-ai/detent?style=flat-square)](LICENSE)
[![downloads](https://img.shields.io/npm/dm/@imbue-ai/detent?style=flat-square)](https://npmjs.com/package/@imbue-ai/detent)

Fine-grained HTTP permissions for AI agents.

## Quick example

```bash
# Store rules.
echo '{
  "rules": [
    {"github-rest-api": ["github-read-all", "github-write-issues"]},
    {"slack-api": ["slack-read-all"]}
  ]
}' > ~/.config/detent/config.json

# Check a request before sending.
# (Exit code: 0 = approved, 1 = rejected.)
detent curl -s https://api.github.com/repos/octocat/Hello-World/issues/1
```

## Installation

```bash
npm install -g @imbue-ai/detent
```

(This is not needed if you only intend to use Detent as a JavaScript library.)


## Motivation

Users of AI agents sometimes give them access to services like
Slack, Google Drive, GitHub and others. Giving agents full
access is unnecessarily risky - the best practice in most cases
is giving only the necessary level of access. In practice, that
can be challenging, especially for services that do not offer
native granular permissions.

Detent is meant to address this. Users or developers can easily specify
permissions, from broad ones ("only read access to my Slack") to
more specific ones ("only read access to GitHub issues for this one repository").

## Integrations

Checking permissions is only useful if the results are
respected. To be effective, Detent needs to be integrated into
whatever tool the agent uses to access third-party services.

### Latchkey

[Latchkey](https://github.com/imbue-ai/latchkey) lets users
point to a Detent config in order to control what agents can and
can't access.

## Details and architecture

Detent is a command line tool and a Typescript library. It allows users and developers to:

1. Define named permissions for outgoing HTTP requests.
2. Check that a given request is allowed given the defined permissions.

### Usage

Store your permission setup in a config file as documented
below. Then assemble a `curl` invocation for an HTTP request and
prepend it with the `detent` command (`detent curl ...`) to
check whether it's allowed. Detent returns 0 if the request is
allowed based on the config, 1 if it's not allowed and 2 or
higher in case of errors. No requests are actually sent.

Alternatively, use `detent` as a library:

```ts
import { check } from "detent";

const request = new Request("https://api.example.com/users", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "alice" }),
});

const result = await check(request);
```

### Configuration

All the configuration goes to `~/.config/detent/config.json` (or
`$XDG_CONFIG_HOME/detent/config.json` if `XDG_CONFIG_HOME` is set). Use the `DETENT_CONFIG`
environment variable to specify a different path.

### Matching requests

An HTTP(s) request can be represented as an object that has
several well-defined properties: `protocol`, `domain`, `port`,
`path`, `method`, `headers`, `queryParams` and `body`. Using this
representation, the `detent` tool uses [JSON schema](https://json-schema.org/) to:

1. Match requests to permission checks.
2. Define the "acceptable" shape of a request that is subject to a permission check. 

Some of the fields are normalized to canonical form before matching:
`method` is always uppercase (e.g. `"GET"`), `protocol`,
`domain` and `headers` keys are always lowercase (e.g. `"content-type"`).

#### Request schemas

We use JSON schema for matching and validating request objects. For example:

```json
{
  "properties": {
    "method": { "const": "GET" }
  },
  "required": ["method"]
}
```

This would match all GET requests, regardless of the domain,
path, or anything else. Schemas must use normalized field
values (uppercase for methods etc.).

In the Detent config, schemas are identified by names, like this:

```json
{
  "schemas": {
    "github-api": {
      "properties": {
        "domain": { "const": "api.github.com" }
      },
      "required": ["domain"]
    },
    "github-read-issues-detent": {
      "properties": {
        "method": { "const": "GET" },
        "path": {
          "type": "string",
          "pattern": "^/repos/imbue-ai/detent/issues(/[0-9]+)?$"
        }
      },
      "required": ["method", "path"]
    },
    ...
  }
}
```

For a complete example config that defines custom schemas, see
[docs/example-cloudflare.json](docs/example-cloudflare.json).

### Permission rules

Once defined, request schemas can be combined in a two-level rules hierarchy, like this:

```json
{
  "schemas": {...},
  "rules": [
    {"github-api": ["github-read-issues-detent", "github-write-comments-detent", ...] },
    {"slack-api": ["slack-read-all"] }
  ]
}
```

In each rule, the key defines scope ("should a given request be
subject to this rule") and each value represents a list of permissions
allowed by this rule.

This is the meaning of the rules in the example above:
  - When accessing the GitHub API, the only allowed actions are reading issues and writing comments in the Detent repository.
  - When accessing the Slack API, only read actions are allowed.
  - No other requests are allowed.

### Rule resolution, default outcomes

When a request gets checked, the rules in your config are simply
evaluated from top to bottom. The first rule whose scope matches
the request determines the outcome: if the request matches any
of the permissions in the rule, it's approved. Otherwise, it's
rejected. Further rules are not evaluated. By default, requests
that don't match any rule get rejected. If you want to allow
requests by default, append the `{"any": ["any"]}` rule to the
end of your rule list.


### Built-in schemas

Detent comes with a number of preconfigured schemas out of the box that
are automatically available and recognized in rule bodies:

- `any` (to match and allow any and all requests)
- `aws-s3` (to identify requests going to AWS S3)
- `aws-s3-read` (to allow read operations on AWS S3)
- `stripe-read-all` (to allow all read operations in Stripe API)
- `google-drive-write-comments` (to allow adding comments to Google Drive items)
- ... and many others, see [docs/builtin-schemas.md](docs/builtin-schemas.md) for the full list

Run `detent dump` to see your current config together with all the
available built-in schemas. If you only want to list the schema
names, run `detent dump | jq '.schemas | keys'`.

If you don't want to use the built-in schemas, set the
`DETENT_DO_NOT_USE_BUILTIN_SCHEMAS` environment variable to
a non-empty value.


### Including other config files

Use the `include` key to split your configuration across
multiple files. Paths are resolved relative to the directory of
the config that contains the `include`.

```json
{
  "include": ["shared/example.json", "shared/another_example.json"],
  "rules": [
    {"github-rest-api": ["github-read-issues"]}
  ]
}
```

Included configs are merged recursively: schemas and rules from
all included files are collected first (in list order), then the
including config's own schemas and rules are applied on top.
This means the parent config's schemas override equally-named
included schemas, and its rules are evaluated after included
rules. Circular includes are detected and rejected.


## Contributing

Contributions of all kinds are welcome!

## Disclaimer

We're providing the preconfigured schemas for convenience, but
it's likely that some of them may not work entirely as intended.
We hope that the community will help us refine the built-in
permission definitions over time. In the meantime, preferably
double-check built-in definitions before using them, and when
possible, use API tokens with reduced permission scopes.

We still think the tool is useful in its current form as a protection
against accidental agent actions and the first line of defense
against malicious or compromised agents.
