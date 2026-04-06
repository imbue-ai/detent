# Detent

Define named permissions for accessing third-party services and check HTTP requests for compliance.

## Quick example

```bash
# Store rules.
echo '{
  "permissions": {
      "api.github.com": ["read-pull-requests", "read-issues"],
      "api.linear.app": ["read-teams", "read-issues", "write-issues"]
  }
}' > ~/.config/detent/config.json

# Check requests.
# (The verdict is determined by the exit code.)
detent curl -s https://api.github.com/repos/octocat/Hello-World/issues/1
case $? in
  0) echo "Approved" ;;
  1) echo "Not approved" ;;
  *) echo "Error" ;;
esac
```


## Motivation

As a user, I want to let agents work with third party tools, for instance via Latchkey. However, giving them full access to services like Slack, GitHub, or Gmail feels risky. I need an easy way of restricting agent access even if the services do not natively support it. For example: only allow read operations.

This could also be true not just for end users but for application developers who want to use agents under the hood.


## Details and architecture

Detent is a command line tool and a Typescript library. It allows users to:

1. Define named permissions for domains / third-party services.
2. Check that a given request is allowed given the defined permissions.

### Configuration

All the configuration as described below goes to `~/.config/detent/config.json`. Use the `DETENT_CONFIG` environment variable to override the location of `config.json` if necessary.

### Matching requests

An HTTP(s) request can be represented as an object that has several well defined properties: `protocol`, `domain`, `port`, `path`, `headers`, queryParams` and `body`. Using this representation, the `detent` tool uses [JSON schemas](https://json-schema.org/) to:

1. Define the "acceptable" shape of a request that is subject to a permission check.
2. Match requests to permission checks to be applied.

#### Request matches 

A "request match" is defined by two things, a name and a request json schema (the part that's applicable for the request object's `properties`). For example:

```json
{
  "method": {
    "const": "GET"
  }
}
```

This would match all GET requests, regardless of the domain, path, or anything else.

### Permission checks.

Once defined, request matches can be combined in a two-level rules hierarchy, like this:

```json
{
  "rules": [
    {"github-api": ["github-read-issues-detent", "github-write-comments-detent", ...] },
    {"slack-api": ["get-method-only"] }
  ],
}
```

For the config to work, you would need to define all the necessary request matches, like this:

```json
{
  "definitions": {
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

### Built-in permissions

Detent comes with many match definitions out of the box that are automatically available and recognized in rule bodies. Run `detent dump` to see your current config enriched with all the existing built-in definitions.

If you don't want the built-in definitions to apply, set the
`DETENT_DO_NOT_USE_BUILTIN_DEFINITIONS` environment variable to
a non-empty value.


### Rule resolution, default outcomes

When a request gets checked, the rules in your config are
simply evaluated from top to bottom. The first matching rule
determines the outcome: if the request falls under any of the permissions


### Canonization
