# Built-in schemas

Detent ships with the following preconfigured request schemas.
Schemas marked *(scope)* identify requests to a particular
service and are meant to be used as rule keys. The remaining
schemas define permissions and are meant to be used as rule values.

The AWS ones are a special case: the service-specific
ones like `aws-s3` or `aws-ec2` only match on domain, so
they can serve as scopes (e.g. `{"aws-s3": ["aws-s3-read"]}`)
or as permissions inside a broader `aws` scope
(e.g. `{"aws": ["aws-s3"]}` to allow all S3 access).

See the main [README](../README.md) for how schemas and rules work together.
### airtable-mcp

- `airtable-mcp-api` *(scope)*
- `airtable-mcp-session`
- `airtable-mcp-read-all`
- `airtable-mcp-write-all`
- `airtable-mcp-read-bases`
- `airtable-mcp-write-bases`
- `airtable-mcp-read-tables`
- `airtable-mcp-write-tables`
- `airtable-mcp-delete-tables`
- `airtable-mcp-read-records`
- `airtable-mcp-write-records`
- `airtable-mcp-delete-records`
- `airtable-mcp-read-interfaces`
- `airtable-mcp-write-interfaces`
- `airtable-mcp-delete-interfaces`
- `airtable-mcp-submit-forms`
- `airtable-mcp-read-automations`
- `airtable-mcp-write-automations`
- `airtable-mcp-delete-automations`

### any

- `any`

### anydo-mcp

- `anydo-mcp-api` *(scope)*
- `anydo-mcp-session`
- `anydo-mcp-read-all`
- `anydo-mcp-write-all`
- `anydo-mcp-read-tasks`
- `anydo-mcp-write-tasks`
- `anydo-mcp-set-reminders`
- `anydo-mcp-read-workspaces`
- `anydo-mcp-write-workspaces`
- `anydo-mcp-read-calendar-events`
- `anydo-mcp-write-calendar-events`
- `anydo-mcp-delete-calendar-events`
- `anydo-mcp-read-account`

### atlassian-mcp

- `atlassian-mcp-api` *(scope)*
- `atlassian-mcp-session`
- `atlassian-mcp-read-all`
- `atlassian-mcp-write-all`
- `atlassian-mcp-read-account-and-tool-catalog`
- `atlassian-mcp-write-tool-catalog`
- `atlassian-mcp-read-jira`
- `atlassian-mcp-write-jira`
- `atlassian-mcp-delete-jira`
- `atlassian-mcp-read-confluence-and-loom`
- `atlassian-mcp-write-confluence-and-loom`
- `atlassian-mcp-read-jsm`
- `atlassian-mcp-write-jsm`
- `atlassian-mcp-read-bitbucket-and-code`
- `atlassian-mcp-write-bitbucket`
- `atlassian-mcp-read-teamwork`
- `atlassian-mcp-write-teamwork`
- `atlassian-mcp-read-workforce-planning`
- `atlassian-mcp-write-workforce-planning`

### attio-mcp

- `attio-mcp-api` *(scope)*
- `attio-mcp-session`
- `attio-mcp-read-all`
- `attio-mcp-write-all`
- `attio-mcp-read-records`
- `attio-mcp-write-records`
- `attio-mcp-read-activities`
- `attio-mcp-write-activities`
- `attio-mcp-read-lists`
- `attio-mcp-write-lists`
- `attio-mcp-read-comments`
- `attio-mcp-write-comments`
- `attio-mcp-delete-comments`
- `attio-mcp-read-notes`
- `attio-mcp-write-notes`
- `attio-mcp-read-tasks`
- `attio-mcp-write-tasks`
- `attio-mcp-delete-tasks`
- `attio-mcp-read-meetings`
- `attio-mcp-read-emails`
- `attio-mcp-read-workspace`
- `attio-mcp-run-reports`

### aws

- `aws` *(scope)*
- `aws-s3`
- `aws-s3-read`
- `aws-s3-write`
- `aws-ec2`
- `aws-iam`
- `aws-sts`
- `aws-lambda`
- `aws-dynamodb`
- `aws-cloudformation`
- `aws-logs`
- `aws-cloudwatch`
- `aws-sns`
- `aws-sqs`
- `aws-ssm`
- `aws-secretsmanager`
- `aws-route53`
- `aws-ecs`
- `aws-ecr`
- `aws-eks`
- `aws-bedrock`
- `aws-cloudfront`
- `aws-rds`
- `aws-kms`
- `aws-elb`
- `aws-cloudtrail`
- `aws-eventbridge`
- `aws-kinesis`

### beehiiv-mcp

- `beehiiv-mcp-api` *(scope)*
- `beehiiv-mcp-session`
- `beehiiv-mcp-read-all`
- `beehiiv-mcp-write-all`

### buildkite-mcp

- `buildkite-mcp-api` *(scope)*
- `buildkite-mcp-session`
- `buildkite-mcp-read-all`
- `buildkite-mcp-write-all`
- `buildkite-mcp-read-account`
- `buildkite-mcp-read-clusters`
- `buildkite-mcp-read-agents`
- `buildkite-mcp-read-pipelines`
- `buildkite-mcp-read-builds`
- `buildkite-mcp-read-logs`
- `buildkite-mcp-read-artifacts`
- `buildkite-mcp-read-tests`
- `buildkite-mcp-read-skills`
- `buildkite-mcp-write-clusters`
- `buildkite-mcp-write-pipelines`
- `buildkite-mcp-write-builds`
- `buildkite-mcp-write-annotations`

### cal-com-mcp

- `cal-com-mcp-api` *(scope)*
- `cal-com-mcp-session`
- `cal-com-mcp-read-all`
- `cal-com-mcp-write-all`
- `cal-com-mcp-read-docs`
- `cal-com-mcp-read-profile`
- `cal-com-mcp-write-profile`
- `cal-com-mcp-read-event-types`
- `cal-com-mcp-write-event-types`
- `cal-com-mcp-read-bookings`
- `cal-com-mcp-write-bookings`
- `cal-com-mcp-read-schedules`
- `cal-com-mcp-write-schedules`
- `cal-com-mcp-read-teams-and-organizations`
- `cal-com-mcp-write-teams-and-organizations`
- `cal-com-mcp-read-routing-forms`
- `cal-com-mcp-write-routing-forms`
- `cal-com-mcp-call-api-operations`

### calendly

- `calendly-api` *(scope)*
- `calendly-read-all`
- `calendly-write-all`
- `calendly-read-scheduled-events`
- `calendly-write-scheduled-events`
- `calendly-read-event-types`
- `calendly-write-event-types`
- `calendly-read-availability`
- `calendly-write-availability`
- `calendly-read-users`
- `calendly-read-organizations`
- `calendly-write-organizations`
- `calendly-read-webhooks`
- `calendly-write-webhooks`
- `calendly-read-routing-forms`
- `calendly-write-scheduling-links`
- `calendly-write-shares`
- `calendly-write-data-compliance`

### canva-mcp

- `canva-mcp-api` *(scope)*
- `canva-mcp-session`
- `canva-mcp-read-all`
- `canva-mcp-write-all`
- `canva-mcp-read-designs`
- `canva-mcp-export-designs`
- `canva-mcp-create-designs`
- `canva-mcp-edit-designs`
- `canva-mcp-read-assets`
- `canva-mcp-write-assets`
- `canva-mcp-read-images`
- `canva-mcp-write-images`
- `canva-mcp-read-folders`
- `canva-mcp-write-folders`
- `canva-mcp-read-comments`
- `canva-mcp-write-comments`
- `canva-mcp-read-brand-templates`
- `canva-mcp-write-brand-templates`
- `canva-mcp-help`

### coolify

- `coolify-api` *(scope)*
- `coolify-read-all`
- `coolify-write-all`
- `coolify-read-applications`
- `coolify-write-applications`
- `coolify-deployments`
- `coolify-read-databases`
- `coolify-write-databases`
- `coolify-read-servers`
- `coolify-write-servers`
- `coolify-read-services`
- `coolify-write-services`
- `coolify-read-projects`
- `coolify-write-projects`
- `coolify-read-teams`

### discord

- `discord-api` *(scope)*
- `discord-read-all`
- `discord-write-all`
- `discord-read-messages`
- `discord-write-messages`
- `discord-read-channels`
- `discord-write-channels`
- `discord-read-guilds`
- `discord-write-guilds`
- `discord-read-users`

### dropbox

- `dropbox-api` *(scope)*
- `dropbox-files`
- `dropbox-files-read`
- `dropbox-files-write`
- `dropbox-sharing`
- `dropbox-sharing-read`
- `dropbox-sharing-write`
- `dropbox-account`
- `dropbox-file-requests`
- `dropbox-contacts`

### fastmail

- `fastmail-api` *(scope)*
- `fastmail-dav-api` *(scope)*
- `fastmail-session`
- `fastmail-read-all`
- `fastmail-write-all`
- `fastmail-read-mail`
- `fastmail-write-mail`
- `fastmail-send-mail`
- `fastmail-read-contacts`
- `fastmail-write-contacts`
- `fastmail-read-calendars`
- `fastmail-write-calendars`
- `fastmail-download-blobs`
- `fastmail-upload-blobs`
- `fastmail-dav-discover`
- `fastmail-dav-read-all`
- `fastmail-dav-write-all`
- `fastmail-dav-read-contacts`
- `fastmail-dav-write-contacts`
- `fastmail-dav-read-calendars`
- `fastmail-dav-write-calendars`

### fathom-mcp

- `fathom-mcp-api` *(scope)*
- `fathom-mcp-session`
- `fathom-mcp-read-all`
- `fathom-mcp-read-meetings`
- `fathom-mcp-read-transcripts`
- `fathom-mcp-read-summaries`
- `fathom-mcp-read-account`

### figma

- `figma-api` *(scope)*
- `figma-read-all`
- `figma-write-all`
- `figma-read-files`
- `figma-read-comments`
- `figma-write-comments`
- `figma-read-projects`
- `figma-read-components`
- `figma-read-webhooks`
- `figma-write-webhooks`
- `figma-read-variables`
- `figma-write-variables`
- `figma-read-dev-resources`
- `figma-write-dev-resources`
- `figma-read-library-analytics`

### gamma-mcp

- `gamma-mcp-api` *(scope)*
- `gamma-mcp-session`
- `gamma-mcp-read-all`
- `gamma-mcp-write-all`
- `gamma-mcp-read-gammas`
- `gamma-mcp-read-workspace`
- `gamma-mcp-read-analytics`
- `gamma-mcp-read-job-status`
- `gamma-mcp-export-gammas`
- `gamma-mcp-generate-gammas`
- `gamma-mcp-generate-images`
- `gamma-mcp-edit-gammas`

### github

- `github-rest-api` *(scope)*
- `github-graphql-api` *(scope)*
- `github-git` *(scope)*
- `github-git-read`
- `github-git-write`
- `github-read-all`
- `github-write-all`
- `github-read-repos`
- `github-write-repos`
- `github-read-issues`
- `github-write-issues`
- `github-read-pulls`
- `github-write-pulls`
- `github-read-gists`
- `github-write-gists`
- `github-read-user`
- `github-search`
- `github-read-notifications`
- `github-write-notifications`
- `github-read-activity`
- `github-write-activity`

### gitlab

- `gitlab-api` *(scope)*
- `gitlab-git` *(scope)*
- `gitlab-git-read`
- `gitlab-git-write`
- `gitlab-read-all`
- `gitlab-write-all`
- `gitlab-read-projects`
- `gitlab-write-projects`
- `gitlab-read-repository`
- `gitlab-write-repository`
- `gitlab-read-merge-requests`
- `gitlab-write-merge-requests`
- `gitlab-read-issues`
- `gitlab-write-issues`
- `gitlab-read-pipelines`
- `gitlab-write-pipelines`
- `gitlab-read-users`
- `gitlab-read-groups`
- `gitlab-write-groups`

### google-analytics

- `google-analytics-api` *(scope)*
- `google-analytics-read-all`
- `google-analytics-write-all`
- `google-analytics-run-reports`
- `google-analytics-read-metadata`
- `google-analytics-read-accounts`
- `google-analytics-read-properties`
- `google-analytics-write-properties`
- `google-analytics-read-data-streams`
- `google-analytics-write-data-streams`

### google-calendar

- `google-calendar-api` *(scope)*
- `google-calendar-read-all`
- `google-calendar-write-all`
- `google-calendar-read-events`
- `google-calendar-write-events`
- `google-calendar-read-calendars`
- `google-calendar-write-calendars`
- `google-calendar-read-calendar-list`
- `google-calendar-write-calendar-list`
- `google-calendar-read-settings`
- `google-calendar-read-acl`
- `google-calendar-write-acl`
- `google-calendar-query-freebusy`
- `google-calendar-read-colors`

### google-directions

- `google-directions-api` *(scope)*
- `google-directions-read-all`
- `google-directions-write-all`
- `google-directions-compute-routes`
- `google-directions-compute-route-matrix`

### google-docs

- `google-docs-api` *(scope)*
- `google-docs-read-all`
- `google-docs-write-all`
- `google-docs-read-documents`
- `google-docs-write-documents`
- `google-docs-create-documents`
- `google-docs-update-documents`

### google-drive

- `google-drive-api` *(scope)*
- `google-drive-read-all`
- `google-drive-write-all`
- `google-drive-read-files`
- `google-drive-write-files`
- `google-drive-read-permissions`
- `google-drive-write-permissions`
- `google-drive-read-comments`
- `google-drive-write-comments`
- `google-drive-read-about`

### google-gmail

- `google-gmail-api` *(scope)*
- `google-gmail-read-all`
- `google-gmail-write-all`
- `google-gmail-read-messages`
- `google-gmail-write-messages`
- `google-gmail-send-messages`
- `google-gmail-read-threads`
- `google-gmail-write-threads`
- `google-gmail-read-labels`
- `google-gmail-write-labels`
- `google-gmail-read-drafts`
- `google-gmail-write-drafts`
- `google-gmail-read-settings`
- `google-gmail-write-settings`
- `google-gmail-read-history`
- `google-gmail-read-profile`

### google-people

- `google-people-api` *(scope)*
- `google-people-read-all`
- `google-people-write-all`
- `google-people-read-contacts`
- `google-people-write-contacts`
- `google-people-read-contact-groups`
- `google-people-write-contact-groups`
- `google-people-read-other-contacts`
- `google-people-write-other-contacts`

### google-sheets

- `google-sheets-api` *(scope)*
- `google-sheets-read-all`
- `google-sheets-write-all`
- `google-sheets-read-spreadsheets`
- `google-sheets-create-spreadsheets`
- `google-sheets-update-spreadsheets`
- `google-sheets-read-values`
- `google-sheets-write-values`

### google-slides

- `google-slides-api` *(scope)*
- `google-slides-read-all`
- `google-slides-write-all`
- `google-slides-read-presentations`
- `google-slides-create-presentations`
- `google-slides-update-presentations`
- `google-slides-read-pages`

### granola-mcp

- `granola-mcp-api` *(scope)*
- `granola-mcp-session`
- `granola-mcp-read-all`
- `granola-mcp-write-all`
- `granola-mcp-read-meetings`
- `granola-mcp-read-transcripts`
- `granola-mcp-read-folders`
- `granola-mcp-write-folders`
- `granola-mcp-read-account`
- `granola-mcp-switch-workspaces`
- `granola-mcp-sign-out`

### huggingface

- `huggingface-api` *(scope)*
- `huggingface-read-all`
- `huggingface-write-all`
- `huggingface-inference`
- `huggingface-download`

### invideo-mcp

- `invideo-mcp-api` *(scope)*
- `invideo-mcp-session`
- `invideo-mcp-read-all`
- `invideo-mcp-write-all`

### linear

- `linear-api` *(scope)*

### linktree-mcp

- `linktree-mcp-api` *(scope)*
- `linktree-mcp-session`
- `linktree-mcp-read-all`
- `linktree-mcp-write-all`
- `linktree-mcp-read-profiles`
- `linktree-mcp-write-profiles`
- `linktree-mcp-read-links`
- `linktree-mcp-write-links`
- `linktree-mcp-delete-links`
- `linktree-mcp-read-appearance`
- `linktree-mcp-write-appearance`
- `linktree-mcp-read-analytics`
- `linktree-mcp-read-recommendations`
- `linktree-mcp-write-recommendations`
- `linktree-mcp-read-workspaces`
- `linktree-mcp-read-messages`
- `linktree-mcp-send-messages`

### mailchimp

- `mailchimp-api` *(scope)*
- `mailchimp-read-all`
- `mailchimp-write-all`
- `mailchimp-read-campaigns`
- `mailchimp-write-campaigns`
- `mailchimp-read-lists`
- `mailchimp-write-lists`
- `mailchimp-read-templates`
- `mailchimp-write-templates`
- `mailchimp-read-automations`
- `mailchimp-write-automations`
- `mailchimp-read-reports`
- `mailchimp-read-file-manager`
- `mailchimp-write-file-manager`
- `mailchimp-read-ecommerce`
- `mailchimp-write-ecommerce`

### neon-mcp

- `neon-mcp-api` *(scope)*
- `neon-mcp-session`
- `neon-mcp-read-all`
- `neon-mcp-write-all`
- `neon-mcp-read-projects-and-branches`
- `neon-mcp-read-databases`
- `neon-mcp-read-auth-and-credentials`
- `neon-mcp-read-computes-and-snapshots`
- `neon-mcp-read-platform-add-ons`
- `neon-mcp-read-logs-and-docs`
- `neon-mcp-write-projects-and-branches`
- `neon-mcp-delete-projects-and-branches`
- `neon-mcp-run-sql`
- `neon-mcp-write-databases`
- `neon-mcp-delete-databases`
- `neon-mcp-write-auth-and-credentials`
- `neon-mcp-get-connection-strings`
- `neon-mcp-write-computes-and-snapshots`
- `neon-mcp-write-platform-add-ons`

### netlify-mcp

- `netlify-mcp-api` *(scope)*
- `netlify-mcp-session`
- `netlify-mcp-read-all`
- `netlify-mcp-write-all`
- `netlify-mcp-read-coding-guidance`
- `netlify-mcp-read-account`
- `netlify-mcp-read-projects`
- `netlify-mcp-read-deploys`
- `netlify-mcp-read-extensions`
- `netlify-mcp-read-observability`
- `netlify-mcp-write-projects`
- `netlify-mcp-write-env-vars`
- `netlify-mcp-write-forms`
- `netlify-mcp-deploy-sites`
- `netlify-mcp-write-extensions`
- `netlify-mcp-import-designs`

### ngrok

- `ngrok-api` *(scope)*
- `ngrok-read-all`
- `ngrok-write-all`
- `ngrok-read-credentials`
- `ngrok-write-credentials`

### notion-mcp

- `notion-mcp-api` *(scope)*
- `notion-mcp-session`
- `notion-mcp-read-all`
- `notion-mcp-write-all`
- `notion-mcp-search`
- `notion-mcp-ai-search`
- `notion-mcp-fetch`
- `notion-mcp-query-data-sources`
- `notion-mcp-query-database-view`
- `notion-mcp-query-meeting-notes`
- `notion-mcp-list-pages`
- `notion-mcp-get-comments`
- `notion-mcp-get-teams`
- `notion-mcp-get-users`
- `notion-mcp-get-self`
- `notion-mcp-get-async-task`
- `notion-mcp-read-skills`
- `notion-mcp-read-attachments`
- `notion-mcp-read-agents`
- `notion-mcp-next-steps`
- `notion-mcp-create-pages`
- `notion-mcp-update-page`
- `notion-mcp-move-pages`
- `notion-mcp-duplicate-page`
- `notion-mcp-convert-page-to-skill`
- `notion-mcp-write-attachments`
- `notion-mcp-create-database`
- `notion-mcp-update-data-source`
- `notion-mcp-create-view`
- `notion-mcp-update-view`
- `notion-mcp-write-folders`
- `notion-mcp-create-comment`
- `notion-mcp-write-agents`

### notion

- `notion-api` *(scope)*
- `notion-read-all`
- `notion-write-all`
- `notion-read-pages`
- `notion-write-pages`
- `notion-read-blocks`
- `notion-write-blocks`
- `notion-read-databases`
- `notion-write-databases`
- `notion-query-databases`
- `notion-read-users`
- `notion-read-comments`
- `notion-write-comments`
- `notion-search`

### openrouter

- `openrouter-api` *(scope)*
- `openrouter-read-all`
- `openrouter-write-all`
- `openrouter-inference`

### otter-mcp

- `otter-mcp-api` *(scope)*
- `otter-mcp-session`
- `otter-mcp-read-all`
- `otter-mcp-search-meetings`
- `otter-mcp-read-transcripts`
- `otter-mcp-read-account`

### paypal-mcp

- `paypal-mcp-api` *(scope)*
- `paypal-mcp-session`
- `paypal-mcp-read-all`
- `paypal-mcp-write-all`
- `paypal-mcp-read-invoices`
- `paypal-mcp-read-products`
- `paypal-mcp-read-subscriptions`
- `paypal-mcp-read-payments`
- `paypal-mcp-read-disputes`
- `paypal-mcp-read-shipments`
- `paypal-mcp-read-reports`
- `paypal-mcp-write-invoices`
- `paypal-mcp-send-invoices`
- `paypal-mcp-delete-invoices`
- `paypal-mcp-write-products`
- `paypal-mcp-write-subscriptions`
- `paypal-mcp-write-shipments`
- `paypal-mcp-move-money`

### peloton-mcp

- `peloton-mcp-api` *(scope)*
- `peloton-mcp-session`
- `peloton-mcp-read-all`
- `peloton-mcp-write-all`
- `peloton-mcp-read-classes`
- `peloton-mcp-create-training-plans`
- `peloton-mcp-schedule-classes`

### posthog-mcp

- `posthog-mcp-api` *(scope)*
- `posthog-mcp-session`
- `posthog-mcp-read-all`
- `posthog-mcp-write-all`
- `posthog-mcp-read-workspace`
- `posthog-mcp-write-workspace`
- `posthog-mcp-read-analytics`
- `posthog-mcp-write-analytics`
- `posthog-mcp-read-experimentation`
- `posthog-mcp-write-experimentation`
- `posthog-mcp-read-people-and-customers`
- `posthog-mcp-write-people-and-customers`
- `posthog-mcp-read-data`
- `posthog-mcp-write-data`
- `posthog-mcp-write-pipelines`
- `posthog-mcp-read-monitoring`
- `posthog-mcp-write-monitoring`
- `posthog-mcp-read-messaging-and-surveys`
- `posthog-mcp-write-messaging-and-surveys`
- `posthog-mcp-read-agents-and-engineering`
- `posthog-mcp-write-agents-and-engineering`

### ramp

- `ramp-api` *(scope)*
- `ramp-read-all`
- `ramp-write-all`
- `ramp-read-accounting`
- `ramp-read-ai-spend`
- `ramp-read-bills`
- `ramp-read-cards`
- `ramp-read-help-center`
- `ramp-read-limits`
- `ramp-read-memos`
- `ramp-read-purchase-orders`
- `ramp-read-reimbursements`
- `ramp-read-tasks`
- `ramp-read-transactions`
- `ramp-read-treasury`
- `ramp-read-trips`
- `ramp-read-unified-requests`
- `ramp-read-users`
- `ramp-read-vendors`
- `ramp-write-approvals`
- `ramp-write-cards`
- `ramp-write-comments`
- `ramp-write-funds`
- `ramp-write-limits`
- `ramp-write-receipts`
- `ramp-write-reimbursements`
- `ramp-write-transactions`
- `ramp-write-trips`
- `ramp-write-vendors`
- `ramp-write-x402`

### readwise-mcp

- `readwise-mcp-api` *(scope)*
- `readwise-mcp-session`
- `readwise-mcp-read-all`
- `readwise-mcp-write-all`
- `readwise-mcp-read-highlights`
- `readwise-mcp-write-highlights`
- `readwise-mcp-delete-highlights`
- `readwise-mcp-read-documents`
- `readwise-mcp-write-documents`
- `readwise-mcp-export-documents`
- `readwise-mcp-read-books`
- `readwise-mcp-write-books`
- `readwise-mcp-delete-books`
- `readwise-mcp-read-public-tokens`
- `readwise-mcp-write-public-tokens`

### sentry

- `sentry-api` *(scope)*
- `sentry-read-all`
- `sentry-write-all`
- `sentry-read-issues`
- `sentry-write-issues`
- `sentry-read-projects`
- `sentry-write-projects`
- `sentry-read-organizations`
- `sentry-read-teams`
- `sentry-read-releases`
- `sentry-write-releases`

### slack

- `slack-api` *(scope)*
- `slack-read-all`
- `slack-write-all`
- `slack-auth-read`
- `slack-auth-write`
- `slack-chat-read`
- `slack-chat-write`
- `slack-conversations-read`
- `slack-conversations-write`
- `slack-users-read`
- `slack-users-write`
- `slack-files-read`
- `slack-files-write`
- `slack-reactions-read`
- `slack-reactions-write`
- `slack-search`
- `slack-pins-read`
- `slack-pins-write`
- `slack-bookmarks-read`
- `slack-bookmarks-write`
- `slack-reminders-read`
- `slack-reminders-write`
- `slack-later-read`
- `slack-later-write`

### stripe

- `stripe-api` *(scope)*
- `stripe-read-all`
- `stripe-write-all`
- `stripe-read-customers`
- `stripe-write-customers`
- `stripe-read-payments`
- `stripe-write-payments`
- `stripe-read-subscriptions`
- `stripe-write-subscriptions`
- `stripe-read-invoices`
- `stripe-write-invoices`
- `stripe-read-products`
- `stripe-write-products`
- `stripe-read-balance`
- `stripe-read-refunds`
- `stripe-write-refunds`
- `stripe-read-disputes`
- `stripe-write-disputes`
- `stripe-read-payouts`
- `stripe-write-payouts`
- `stripe-read-events`

### supabase-mcp

- `supabase-mcp-api` *(scope)*
- `supabase-mcp-session`
- `supabase-mcp-read-all`
- `supabase-mcp-write-all`
- `supabase-mcp-read-database`
- `supabase-mcp-execute-sql`
- `supabase-mcp-write-database`
- `supabase-mcp-read-logs`
- `supabase-mcp-read-development`
- `supabase-mcp-read-edge-functions`
- `supabase-mcp-write-edge-functions`
- `supabase-mcp-read-projects`
- `supabase-mcp-write-projects`
- `supabase-mcp-read-docs`
- `supabase-mcp-read-branches`
- `supabase-mcp-write-branches`
- `supabase-mcp-delete-branches`
- `supabase-mcp-read-storage`
- `supabase-mcp-write-storage`
- `supabase-mcp-read-notebooks`
- `supabase-mcp-write-notebooks`
- `supabase-mcp-send-feedback`

### tailscale

- `tailscale-api` *(scope)*
- `tailscale-read-all`
- `tailscale-write-all`
- `tailscale-read-users`
- `tailscale-write-users`
- `tailscale-read-devices`
- `tailscale-write-devices`
- `tailscale-read-keys`
- `tailscale-write-keys`

### telegram

- `telegram-api` *(scope)*
- `telegram-send-messages`
- `telegram-manage-messages`
- `telegram-updates`
- `telegram-manage-chats`
- `telegram-bot-info`
- `telegram-stickers`
- `telegram-payments`

### ticktick-mcp

- `ticktick-mcp-api` *(scope)*
- `ticktick-mcp-session`
- `ticktick-mcp-read-all`
- `ticktick-mcp-write-all`
- `ticktick-mcp-read-tasks`
- `ticktick-mcp-write-tasks`
- `ticktick-mcp-delete-tasks`
- `ticktick-mcp-read-lists`
- `ticktick-mcp-write-lists`
- `ticktick-mcp-read-tags`
- `ticktick-mcp-write-tags`
- `ticktick-mcp-read-habits`
- `ticktick-mcp-write-habits`
- `ticktick-mcp-read-focus-records`
- `ticktick-mcp-write-focus-records`
- `ticktick-mcp-read-calendar-events`
- `ticktick-mcp-read-countdowns`

### todoist

- `todoist-api` *(scope)*
- `todoist-read-all`
- `todoist-write-all`
- `todoist-read-projects`
- `todoist-write-projects`
- `todoist-read-sections`
- `todoist-write-sections`
- `todoist-read-tasks`
- `todoist-write-tasks`
- `todoist-complete-tasks`
- `todoist-read-comments`
- `todoist-write-comments`
- `todoist-read-labels`
- `todoist-write-labels`
- `todoist-sync`

### trello-mcp

- `trello-mcp-api` *(scope)*
- `trello-mcp-session`
- `trello-mcp-read-all`
- `trello-mcp-write-all`
- `trello-mcp-read-profile`
- `trello-mcp-read-boards`
- `trello-mcp-write-boards`
- `trello-mcp-read-cards`
- `trello-mcp-write-cards`
- `trello-mcp-search`
- `trello-mcp-read-inbox`
- `trello-mcp-write-inbox`
- `trello-mcp-read-planner`
- `trello-mcp-write-planner`

### umami

- `umami-api` *(scope)*
- `umami-read-all`
- `umami-write-all`
- `umami-read-websites`
- `umami-write-websites`
- `umami-read-stats`
- `umami-read-reports`
- `umami-write-reports`
- `umami-read-teams`
- `umami-write-teams`
- `umami-read-me`

### vercel-mcp

- `vercel-mcp-api` *(scope)*
- `vercel-mcp-session`
- `vercel-mcp-read-all`
- `vercel-mcp-write-all`
- `vercel-mcp-read-account`
- `vercel-mcp-send-feedback`
- `vercel-mcp-read-projects-and-deployments`
- `vercel-mcp-write-projects-and-deployments`
- `vercel-mcp-read-domains-and-routing`
- `vercel-mcp-write-domains-and-routing`
- `vercel-mcp-make-purchases`
- `vercel-mcp-read-configuration`
- `vercel-mcp-write-configuration`
- `vercel-mcp-read-observability-and-analytics`
- `vercel-mcp-write-observability-and-analytics`
- `vercel-mcp-read-storage-and-sandboxes`
- `vercel-mcp-write-storage-and-sandboxes`
- `vercel-mcp-read-toolbar`
- `vercel-mcp-write-toolbar`

### webflow-mcp

- `webflow-mcp-api` *(scope)*
- `webflow-mcp-session`
- `webflow-mcp-read-all`
- `webflow-mcp-write-all`
- `webflow-mcp-read-analytics`
- `webflow-mcp-read-guidance`
- `webflow-mcp-read-previews`
- `webflow-mcp-write-sites`
- `webflow-mcp-write-pages`
- `webflow-mcp-write-cms`
- `webflow-mcp-write-localization`
- `webflow-mcp-write-design`
- `webflow-mcp-write-assets`
- `webflow-mcp-write-comments`
- `webflow-mcp-write-campaigns-and-forms`
- `webflow-mcp-write-custom-code`
- `webflow-mcp-write-site-settings`
- `webflow-mcp-write-cloud-apps`

### wix-mcp

- `wix-mcp-api` *(scope)*
- `wix-mcp-session`
- `wix-mcp-read-all`
- `wix-mcp-write-all`
- `wix-mcp-read-docs`
- `wix-mcp-read-sites`
- `wix-mcp-call-site-apis`
- `wix-mcp-write-sites`
- `wix-mcp-write-media`
- `wix-mcp-send-feedback`

### yelp

- `yelp-api` *(scope)*
- `yelp-read-all`
- `yelp-write-all`
- `yelp-read-businesses`
- `yelp-write-businesses`
- `yelp-read-reviews`
- `yelp-read-events`
- `yelp-read-categories`
- `yelp-autocomplete`
- `yelp-ai-chat`

### zoom

- `zoom-api` *(scope)*
- `zoom-read-all`
- `zoom-write-all`
- `zoom-read-meetings`
- `zoom-write-meetings`
- `zoom-read-webinars`
- `zoom-write-webinars`
- `zoom-read-recordings`
- `zoom-write-recordings`
- `zoom-read-reports`
- `zoom-read-users`
- `zoom-write-users`
