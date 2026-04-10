# Built-in patterns

Detent ships with the following built-in request patterns.
Patterns marked *(scope)* identify requests to a particular
service and are meant to be used as rule keys. The remaining
patterns define permissions and are meant to be used as rule values.

The AWS patterns are a special case: the service-specific
patterns like `aws-s3` or `aws-ec2` only match on domain, so
they can serve as scopes (e.g. `{"aws-s3": ["aws-s3-read"]}`)
or as permissions inside a broader `aws` scope
(e.g. `{"aws": ["aws-s3"]}` to allow all S3 access).

See the main [README](../README.md) for how patterns and rules work together.
### any

- `any`

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

### github

- `github-rest-api` *(scope)*
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

### gitlab

- `gitlab-api` *(scope)*
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

### linear

- `linear-api` *(scope)*

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

### telegram

- `telegram-api` *(scope)*
- `telegram-send-messages`
- `telegram-manage-messages`
- `telegram-updates`
- `telegram-manage-chats`
- `telegram-bot-info`
- `telegram-stickers`
- `telegram-payments`

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
