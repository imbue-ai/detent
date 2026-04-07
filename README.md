# Detent

Define named permissions for accessing third-party services and check HTTP requests for compliance.

## Quick example

```bash
# Store rules.
echo '{
  "rules": [
    {"github-api": ["github-read-issues", "github-write-comments"]},
    {"slack-api": ["get-method-only"]}
  ]
}' > ~/.config/detent/config.json

# Check requests.
# (The verdict is determined by the exit code.)
detent curl -s https://api.github.com/repos/octocat/Hello-World/issues/1
```

## Installation

```bash
npm install -g detent
```


## Motivation

As a user, I want to let agents work with third party tools, for
instance via Latchkey. However, giving them full access to
services like Slack, GitHub, or Gmail feels risky. I need an
easy way of restricting agent access even if the services do not
natively support it. For example: only allow read operations.

This could also be true not just for end users but for
application developers who want to use agents under the hood.


## Details and architecture

Detent is a command line tool and a Typescript library. It allows users to:

1. Define named permissions for outgoing HTTP requests.
2. Check that a given request is allowed given the defined permissions.

### Usage

Store your permission setup in a config file as documented
below. Then assemble a `curl` invocation defining the HTTP
request you want to send and call `detent curl ...` to check its
admissibility.  All the arguments that come after `detent curl`
are interpreted as part of the desired `curl` call.  Detent
returns 0 if the request is allowed based on the config, 1 if
it's not allowed and 2 or higher in case of errors.  No requests
are actually sent.

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

All the configuration as described below goes to
`~/.config/detent/config.json`. Use the `DETENT_CONFIG`
environment variable to override the location of `config.json`
if necessary.

### Matching requests

An HTTP(s) request can be represented as an object that has several well defined properties: `protocol`, `domain`, `port`, `path`, `method`, `headers`, `queryParams` and `body`. Using this representation, the `detent` tool uses [JSON schemas](https://json-schema.org/) to:

1. Match requests to permission checks.
2. Define the "acceptable" shape of a request that is subject to a permission check.

#### Request patterns 

A "request pattern" is defined by a json schema (the part that's applicable for the request object's `properties`). For example:

```json
{
  "method": {
    "const": "GET"
  }
}
```

This would match all GET requests, regardless of the domain, path, or anything else.

### Permission checks.

Once defined, request patterns can be combined in a two-level rules hierarchy, like this:

```json
{
  "rules": [
    {"github-api": ["github-read-issues-detent", "github-write-comments-detent", ...] },
    {"slack-api": ["get-method-only"] }
  ],
}
```

In each rule, the key defines scope ("should a given request be
subject to this rule") and each value represents a list of permissions
allowed by this rule. The last line in the example above would
thus say that "only GET requests are allowed to the slack API".

For the config to work, you would need to define all the necessary request patterns, like this:

```json
{
  "patterns": {
    "github-api": {
      "domain": {
        "const": "api.github.com"
      }
    },
    "github-read-issues-detent": {
      "method": {
        "const": "GET"
      },
      "path": {
        "type": "string",
        "pattern": "^/repos/imbue-ai/detent/issues(/[0-9]+)?$"
      }
    },
    ...
  },
  "rules": [
    ...
  ]
}
```

### Rule resolution, default outcomes

When a request gets checked, the rules in your config are simply
evaluated from top to bottom. The first rule whose scope matches
the request determines the outcome: if the request matches any
of the permissions in the rule, it's approved. Otherwise, it's
rejected. Further rules are not evaluated. By default, requests
that don't match any rule get rejected. If you want to allow
them by default, append the rule `{"any": ["any"]}` to the very
end of your rule list.


### Built-in permissions

Detent comes with many pattern definitions out of the box that
are automatically available and recognized in rule bodies. Run
`detent dump` to see your current config enriched with all the
existing built-in patterns. If you only want to list the pattern
names, run `detent dump | jq '.patterns | keys'`.

If you don't want the built-in patterns to apply, set the
`DETENT_DO_NOT_USE_BUILTIN_PATTERNS` environment variable to
a non-empty value.



