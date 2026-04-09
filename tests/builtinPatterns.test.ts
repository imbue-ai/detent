import { describe, it, expect } from 'vitest';
import { builtinPatterns } from '../src/patterns/requestPattern.js';
import type { DecomposedRequest } from '../src/decomposedRequest.js';

function makeRequest(overrides: Partial<DecomposedRequest> = {}): DecomposedRequest {
  return {
    protocol: 'https',
    domain: 'example.com',
    port: 443,
    path: '/',
    method: 'GET',
    headers: {},
    queryParams: {},
    body: undefined,
    ...overrides,
  };
}

function expectPatternExists(name: string) {
  expect(builtinPatterns[name], `Expected builtin pattern "${name}" to exist`).toBeDefined();
}

describe('builtin patterns: aws', () => {
  it('aws scope matches regional endpoints', () => {
    expectPatternExists('aws');
    expect(builtinPatterns.aws!.match(makeRequest({ domain: 'ec2.us-east-1.amazonaws.com' }))).toBe(
      true
    );
    expect(builtinPatterns.aws!.match(makeRequest({ domain: 's3.us-west-2.amazonaws.com' }))).toBe(
      true
    );
  });

  it('aws scope matches global endpoints without region', () => {
    expect(builtinPatterns.aws!.match(makeRequest({ domain: 'ec2.amazonaws.com' }))).toBe(true);
    expect(builtinPatterns.aws!.match(makeRequest({ domain: 'iam.amazonaws.com' }))).toBe(true);
  });

  it('aws scope rejects unrelated domains', () => {
    expect(builtinPatterns.aws!.match(makeRequest({ domain: 'amazonaws.example.com' }))).toBe(
      false
    );
  });

  it('aws-read-all matches GET and HEAD but not POST', () => {
    expectPatternExists('aws-read-all');
    expect(builtinPatterns['aws-read-all']!.match(makeRequest({ method: 'GET' }))).toBe(true);
    expect(builtinPatterns['aws-read-all']!.match(makeRequest({ method: 'HEAD' }))).toBe(true);
    expect(builtinPatterns['aws-read-all']!.match(makeRequest({ method: 'POST' }))).toBe(false);
  });

  it('aws-write-all matches POST, PUT, PATCH, DELETE but not GET', () => {
    expectPatternExists('aws-write-all');
    expect(builtinPatterns['aws-write-all']!.match(makeRequest({ method: 'POST' }))).toBe(true);
    expect(builtinPatterns['aws-write-all']!.match(makeRequest({ method: 'DELETE' }))).toBe(true);
    expect(builtinPatterns['aws-write-all']!.match(makeRequest({ method: 'GET' }))).toBe(false);
  });

  it('service-specific patterns match regional endpoints', () => {
    const regionalEndpoints: Record<string, string> = {
      'aws-ec2': 'ec2.us-east-1.amazonaws.com',
      'aws-lambda': 'lambda.us-west-2.amazonaws.com',
      'aws-dynamodb': 'dynamodb.eu-west-1.amazonaws.com',
      'aws-cloudformation': 'cloudformation.us-east-1.amazonaws.com',
      'aws-logs': 'logs.us-east-1.amazonaws.com',
      'aws-cloudwatch': 'monitoring.us-east-1.amazonaws.com',
      'aws-sns': 'sns.us-east-1.amazonaws.com',
      'aws-sqs': 'sqs.us-east-1.amazonaws.com',
      'aws-ssm': 'ssm.us-east-1.amazonaws.com',
      'aws-secretsmanager': 'secretsmanager.us-east-1.amazonaws.com',
      'aws-ecs': 'ecs.us-east-1.amazonaws.com',
      'aws-ecr': 'ecr.us-east-1.amazonaws.com',
      'aws-eks': 'eks.us-east-1.amazonaws.com',
      'aws-bedrock': 'bedrock.us-east-1.amazonaws.com',
      'aws-rds': 'rds.us-east-1.amazonaws.com',
      'aws-kms': 'kms.us-east-1.amazonaws.com',
      'aws-elb': 'elasticloadbalancing.us-east-1.amazonaws.com',
      'aws-cloudtrail': 'cloudtrail.us-east-1.amazonaws.com',
      'aws-eventbridge': 'events.us-east-1.amazonaws.com',
      'aws-kinesis': 'kinesis.us-east-1.amazonaws.com',
      'aws-s3': 's3.us-east-1.amazonaws.com',
      'aws-iam': 'iam.us-east-1.amazonaws.com',
      'aws-sts': 'sts.us-east-1.amazonaws.com',
      'aws-route53': 'route53.us-east-1.amazonaws.com',
      'aws-cloudfront': 'cloudfront.us-east-1.amazonaws.com',
    };

    for (const [pattern, domain] of Object.entries(regionalEndpoints)) {
      expectPatternExists(pattern);
      expect(
        builtinPatterns[pattern]!.match(makeRequest({ domain })),
        `Expected "${pattern}" to match regional domain "${domain}"`
      ).toBe(true);
    }
  });

  it('service-specific patterns match global endpoints without region', () => {
    const globalEndpoints: Record<string, string> = {
      'aws-ec2': 'ec2.amazonaws.com',
      'aws-lambda': 'lambda.amazonaws.com',
      'aws-dynamodb': 'dynamodb.amazonaws.com',
      'aws-cloudformation': 'cloudformation.amazonaws.com',
      'aws-logs': 'logs.amazonaws.com',
      'aws-cloudwatch': 'monitoring.amazonaws.com',
      'aws-sns': 'sns.amazonaws.com',
      'aws-sqs': 'sqs.amazonaws.com',
      'aws-ssm': 'ssm.amazonaws.com',
      'aws-secretsmanager': 'secretsmanager.amazonaws.com',
      'aws-ecs': 'ecs.amazonaws.com',
      'aws-ecr': 'ecr.amazonaws.com',
      'aws-eks': 'eks.amazonaws.com',
      'aws-bedrock': 'bedrock.amazonaws.com',
      'aws-rds': 'rds.amazonaws.com',
      'aws-kms': 'kms.amazonaws.com',
      'aws-elb': 'elasticloadbalancing.amazonaws.com',
      'aws-cloudtrail': 'cloudtrail.amazonaws.com',
      'aws-eventbridge': 'events.amazonaws.com',
      'aws-kinesis': 'kinesis.amazonaws.com',
      'aws-s3': 's3.amazonaws.com',
      'aws-iam': 'iam.amazonaws.com',
      'aws-sts': 'sts.amazonaws.com',
      'aws-route53': 'route53.amazonaws.com',
      'aws-cloudfront': 'cloudfront.amazonaws.com',
    };

    for (const [pattern, domain] of Object.entries(globalEndpoints)) {
      expectPatternExists(pattern);
      expect(
        builtinPatterns[pattern]!.match(makeRequest({ domain })),
        `Expected "${pattern}" to match global domain "${domain}"`
      ).toBe(true);
    }
  });

  it('service-specific patterns match FIPS endpoints', () => {
    expectPatternExists('aws-ec2');
    expect(
      builtinPatterns['aws-ec2']!.match(makeRequest({ domain: 'ec2-fips.us-east-1.amazonaws.com' }))
    ).toBe(true);

    expectPatternExists('aws-s3');
    expect(
      builtinPatterns['aws-s3']!.match(makeRequest({ domain: 's3-fips.us-east-1.amazonaws.com' }))
    ).toBe(true);
  });

  it('service-specific patterns reject unrelated services', () => {
    expect(
      builtinPatterns['aws-ec2']!.match(makeRequest({ domain: 'lambda.us-east-1.amazonaws.com' }))
    ).toBe(false);
    expect(
      builtinPatterns['aws-lambda']!.match(makeRequest({ domain: 'ec2.us-east-1.amazonaws.com' }))
    ).toBe(false);
  });

  it('aws-s3 matches bucket-style domains', () => {
    expectPatternExists('aws-s3');
    expect(
      builtinPatterns['aws-s3']!.match(
        makeRequest({ domain: 'my-bucket.s3.us-east-1.amazonaws.com' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['aws-s3']!.match(makeRequest({ domain: 'my-bucket.s3.amazonaws.com' }))
    ).toBe(true);
  });

  it('aws-s3-read matches GET to S3 and rejects POST', () => {
    expectPatternExists('aws-s3-read');
    expect(
      builtinPatterns['aws-s3-read']!.match(
        makeRequest({ domain: 's3.us-east-1.amazonaws.com', method: 'GET' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['aws-s3-read']!.match(
        makeRequest({ domain: 's3.us-east-1.amazonaws.com', method: 'POST' })
      )
    ).toBe(false);
  });

  it('aws-s3-write matches POST to S3 and rejects GET', () => {
    expectPatternExists('aws-s3-write');
    expect(
      builtinPatterns['aws-s3-write']!.match(
        makeRequest({ domain: 's3.us-east-1.amazonaws.com', method: 'PUT' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['aws-s3-write']!.match(
        makeRequest({ domain: 's3.us-east-1.amazonaws.com', method: 'GET' })
      )
    ).toBe(false);
  });

  it('aws-ecr matches prefixed domains', () => {
    expectPatternExists('aws-ecr');
    expect(
      builtinPatterns['aws-ecr']!.match(makeRequest({ domain: 'api.ecr.us-east-1.amazonaws.com' }))
    ).toBe(true);
    expect(
      builtinPatterns['aws-ecr']!.match(makeRequest({ domain: 'dkr.ecr.us-east-1.amazonaws.com' }))
    ).toBe(true);
  });

  it('aws-bedrock matches runtime subdomain', () => {
    expectPatternExists('aws-bedrock');
    expect(
      builtinPatterns['aws-bedrock']!.match(
        makeRequest({ domain: 'bedrock-runtime.us-east-1.amazonaws.com' })
      )
    ).toBe(true);
  });
});

describe('builtin patterns: calendly', () => {
  it('calendly scope matches api.calendly.com', () => {
    expectPatternExists('calendly');
    const request = makeRequest({ domain: 'api.calendly.com', path: '/users/me' });
    expect(builtinPatterns.calendly!.match(request)).toBe(true);
  });

  it('calendly scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'calendly.example.com' });
    expect(builtinPatterns.calendly!.match(request)).toBe(false);
  });

  it('calendly-read-event-types matches GET to /event_types path', () => {
    expectPatternExists('calendly-read-event-types');
    expect(
      builtinPatterns['calendly-read-event-types']!.match(
        makeRequest({ method: 'GET', path: '/event_types' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['calendly-read-event-types']!.match(
        makeRequest({ method: 'GET', path: '/scheduled_events' })
      )
    ).toBe(false);
  });

  it('calendly-write-webhooks matches POST to /webhook_subscriptions path', () => {
    expectPatternExists('calendly-write-webhooks');
    expect(
      builtinPatterns['calendly-write-webhooks']!.match(
        makeRequest({ method: 'POST', path: '/webhook_subscriptions' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['calendly-write-webhooks']!.match(
        makeRequest({ method: 'POST', path: '/event_types' })
      )
    ).toBe(false);
  });
});

describe('builtin patterns: coolify', () => {
  it('coolify scope matches the coolify API domain', () => {
    expectPatternExists('coolify');
    const request = makeRequest({ domain: 'app.coolify.io', path: '/api/v1/servers' });
    expect(builtinPatterns.coolify!.match(request)).toBe(true);
  });

  it('coolify-read-all matches GET requests', () => {
    expectPatternExists('coolify-read-all');
    const get = makeRequest({ method: 'GET' });
    expect(builtinPatterns['coolify-read-all']!.match(get)).toBe(true);
  });

  it('coolify-write-all rejects GET requests', () => {
    expectPatternExists('coolify-write-all');
    const get = makeRequest({ method: 'GET' });
    expect(builtinPatterns['coolify-write-all']!.match(get)).toBe(false);
  });

  it('coolify-deployments matches deployment-related paths', () => {
    expectPatternExists('coolify-deployments');
    const request = makeRequest({ path: '/api/v1/deployments' });
    expect(builtinPatterns['coolify-deployments']!.match(request)).toBe(true);
  });
});

describe('builtin patterns: discord', () => {
  it('discord scope matches discord.com', () => {
    expectPatternExists('discord');
    const request = makeRequest({ domain: 'discord.com', path: '/api/v10/channels/123' });
    expect(builtinPatterns.discord!.match(request)).toBe(true);
  });

  it('discord scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'discordapp.example.com' });
    expect(builtinPatterns.discord!.match(request)).toBe(false);
  });

  it('discord-read-guilds matches GET to guilds path', () => {
    expectPatternExists('discord-read-guilds');
    expect(
      builtinPatterns['discord-read-guilds']!.match(
        makeRequest({ method: 'GET', path: '/api/v10/guilds/123456' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['discord-read-guilds']!.match(
        makeRequest({ method: 'GET', path: '/api/v10/channels/123' })
      )
    ).toBe(false);
  });

  it('discord-write-messages matches POST to channel messages path', () => {
    expectPatternExists('discord-write-messages');
    expect(
      builtinPatterns['discord-write-messages']!.match(
        makeRequest({ method: 'POST', path: '/api/v10/channels/123/messages' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['discord-write-messages']!.match(
        makeRequest({ method: 'POST', path: '/api/v10/guilds/456' })
      )
    ).toBe(false);
  });
});

describe('builtin patterns: dropbox', () => {
  it('dropbox scope matches api.dropboxapi.com', () => {
    expectPatternExists('dropbox');
    const request = makeRequest({ domain: 'api.dropboxapi.com', path: '/2/files/list_folder' });
    expect(builtinPatterns.dropbox!.match(request)).toBe(true);
  });

  it('dropbox scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'dropbox.example.com' });
    expect(builtinPatterns.dropbox!.match(request)).toBe(false);
  });

  it('dropbox-files-read matches read paths like list_folder', () => {
    expectPatternExists('dropbox-files-read');
    expect(
      builtinPatterns['dropbox-files-read']!.match(makeRequest({ path: '/2/files/list_folder' }))
    ).toBe(true);
    expect(
      builtinPatterns['dropbox-files-read']!.match(makeRequest({ path: '/2/files/upload' }))
    ).toBe(false);
  });

  it('dropbox-sharing-read matches sharing read paths', () => {
    expectPatternExists('dropbox-sharing-read');
    expect(
      builtinPatterns['dropbox-sharing-read']!.match(
        makeRequest({ path: '/2/sharing/list_folders' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['dropbox-sharing-read']!.match(
        makeRequest({ path: '/2/sharing/add_folder_member' })
      )
    ).toBe(false);
  });
});

describe('builtin patterns: figma', () => {
  it('figma scope matches api.figma.com', () => {
    expectPatternExists('figma');
    const request = makeRequest({ domain: 'api.figma.com', path: '/v1/files/abc123' });
    expect(builtinPatterns.figma!.match(request)).toBe(true);
  });

  it('figma scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'figma.example.com' });
    expect(builtinPatterns.figma!.match(request)).toBe(false);
  });

  it('figma-read-files matches GET to /v1/files path', () => {
    expectPatternExists('figma-read-files');
    expect(
      builtinPatterns['figma-read-files']!.match(
        makeRequest({ method: 'GET', path: '/v1/files/abc123' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['figma-read-files']!.match(
        makeRequest({ method: 'GET', path: '/v1/projects/456' })
      )
    ).toBe(false);
  });

  it('figma-write-comments matches POST to comments path', () => {
    expectPatternExists('figma-write-comments');
    expect(
      builtinPatterns['figma-write-comments']!.match(
        makeRequest({ method: 'POST', path: '/v1/files/abc123/comments' })
      )
    ).toBe(true);
  });
});

describe('builtin patterns: github', () => {
  it('github scope matches api.github.com', () => {
    expectPatternExists('github');
    const request = makeRequest({ domain: 'api.github.com', path: '/repos/octocat/hello' });
    expect(builtinPatterns.github!.match(request)).toBe(true);
  });

  it('github scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'github.example.com' });
    expect(builtinPatterns.github!.match(request)).toBe(false);
  });

  it('github-read-issues matches issues path but not pulls', () => {
    expectPatternExists('github-read-issues');
    expect(
      builtinPatterns['github-read-issues']!.match(
        makeRequest({ method: 'GET', path: '/repos/octocat/Hello-World/issues' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['github-read-issues']!.match(
        makeRequest({ method: 'GET', path: '/repos/octocat/Hello-World/pulls' })
      )
    ).toBe(false);
  });

  it('github-search matches /search paths', () => {
    expectPatternExists('github-search');
    expect(
      builtinPatterns['github-search']!.match(
        makeRequest({ method: 'GET', path: '/search/repositories' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['github-search']!.match(
        makeRequest({ method: 'GET', path: '/repos/octocat/Hello-World' })
      )
    ).toBe(false);
  });
});

describe('builtin patterns: gitlab', () => {
  it('gitlab scope matches gitlab.com', () => {
    expectPatternExists('gitlab');
    const request = makeRequest({ domain: 'gitlab.com', path: '/api/v4/projects' });
    expect(builtinPatterns.gitlab!.match(request)).toBe(true);
  });

  it('gitlab scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'gitlab.example.com' });
    expect(builtinPatterns.gitlab!.match(request)).toBe(false);
  });

  it('gitlab-read-merge-requests matches merge_requests path', () => {
    expectPatternExists('gitlab-read-merge-requests');
    expect(
      builtinPatterns['gitlab-read-merge-requests']!.match(
        makeRequest({ method: 'GET', path: '/api/v4/projects/42/merge_requests' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['gitlab-read-merge-requests']!.match(
        makeRequest({ method: 'GET', path: '/api/v4/projects/42/issues' })
      )
    ).toBe(false);
  });

  it('gitlab-write-issues matches POST to issues path', () => {
    expectPatternExists('gitlab-write-issues');
    expect(
      builtinPatterns['gitlab-write-issues']!.match(
        makeRequest({ method: 'POST', path: '/api/v4/projects/42/issues' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['gitlab-write-issues']!.match(
        makeRequest({ method: 'POST', path: '/api/v4/projects/42/merge_requests' })
      )
    ).toBe(false);
  });
});

describe('builtin patterns: google-analytics', () => {
  it('google-analytics scope matches analyticsadmin.googleapis.com', () => {
    expectPatternExists('google-analytics');
    const request = makeRequest({
      domain: 'analyticsadmin.googleapis.com',
      path: '/v1beta/accounts',
    });
    expect(builtinPatterns['google-analytics']!.match(request)).toBe(true);
  });

  it('google-analytics-run-reports matches POST to runReport path', () => {
    expectPatternExists('google-analytics-run-reports');
    expect(
      builtinPatterns['google-analytics-run-reports']!.match(
        makeRequest({ method: 'POST', path: '/v1beta/properties/12345:runReport' })
      )
    ).toBe(true);
  });

  it('google-analytics-read-properties matches GET to properties path', () => {
    expectPatternExists('google-analytics-read-properties');
    expect(
      builtinPatterns['google-analytics-read-properties']!.match(
        makeRequest({ method: 'GET', path: '/v1beta/properties' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['google-analytics-read-properties']!.match(
        makeRequest({ method: 'GET', path: '/v1beta/accounts' })
      )
    ).toBe(false);
  });
});

describe('builtin patterns: google-calendar', () => {
  it('google-calendar scope matches www.googleapis.com with calendar path', () => {
    expectPatternExists('google-calendar');
    const request = makeRequest({
      domain: 'www.googleapis.com',
      path: '/calendar/v3/calendars/primary/events',
    });
    expect(builtinPatterns['google-calendar']!.match(request)).toBe(true);
  });

  it('google-calendar scope rejects www.googleapis.com with non-calendar path', () => {
    const request = makeRequest({
      domain: 'www.googleapis.com',
      path: '/drive/v3/files',
    });
    expect(builtinPatterns['google-calendar']!.match(request)).toBe(false);
  });

  it('google-calendar-read-events matches GET with events path', () => {
    expectPatternExists('google-calendar-read-events');
    expect(
      builtinPatterns['google-calendar-read-events']!.match(
        makeRequest({ method: 'GET', path: '/calendar/v3/calendars/primary/events' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['google-calendar-read-events']!.match(
        makeRequest({ method: 'GET', path: '/calendar/v3/users/me/calendarList' })
      )
    ).toBe(false);
  });

  it('google-calendar-query-freebusy matches POST to freeBusy endpoint', () => {
    expectPatternExists('google-calendar-query-freebusy');
    expect(
      builtinPatterns['google-calendar-query-freebusy']!.match(
        makeRequest({ method: 'POST', path: '/calendar/v3/freeBusy' })
      )
    ).toBe(true);
  });
});

describe('builtin patterns: google-directions', () => {
  it('google-directions scope matches routes.googleapis.com', () => {
    expectPatternExists('google-directions');
    const request = makeRequest({
      domain: 'routes.googleapis.com',
      path: '/directions/v2:computeRoutes',
    });
    expect(builtinPatterns['google-directions']!.match(request)).toBe(true);
  });

  it('google-directions scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'maps.googleapis.com' });
    expect(builtinPatterns['google-directions']!.match(request)).toBe(false);
  });

  it('google-directions-compute-routes matches POST to the correct path', () => {
    expectPatternExists('google-directions-compute-routes');
    const request = makeRequest({
      method: 'POST',
      path: '/directions/v2:computeRoutes',
    });
    expect(builtinPatterns['google-directions-compute-routes']!.match(request)).toBe(true);
  });

  it('google-directions-compute-route-matrix rejects GET', () => {
    expectPatternExists('google-directions-compute-route-matrix');
    const request = makeRequest({
      method: 'GET',
      path: '/distanceMatrix/v2:computeRouteMatrix',
    });
    expect(builtinPatterns['google-directions-compute-route-matrix']!.match(request)).toBe(false);
  });
});

describe('builtin patterns: google-docs', () => {
  it('google-docs scope matches docs.googleapis.com', () => {
    expectPatternExists('google-docs');
    const request = makeRequest({
      domain: 'docs.googleapis.com',
      path: '/v1/documents/abc123',
    });
    expect(builtinPatterns['google-docs']!.match(request)).toBe(true);
  });

  it('google-docs scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'sheets.googleapis.com' });
    expect(builtinPatterns['google-docs']!.match(request)).toBe(false);
  });

  it('google-docs-read-documents matches GET to /v1/documents path', () => {
    expectPatternExists('google-docs-read-documents');
    expect(
      builtinPatterns['google-docs-read-documents']!.match(
        makeRequest({ method: 'GET', path: '/v1/documents/abc123' })
      )
    ).toBe(true);
  });

  it('google-docs-create-documents matches POST to /v1/documents', () => {
    expectPatternExists('google-docs-create-documents');
    expect(
      builtinPatterns['google-docs-create-documents']!.match(
        makeRequest({ method: 'POST', path: '/v1/documents' })
      )
    ).toBe(true);
  });
});

describe('builtin patterns: google-drive', () => {
  it('google-drive scope matches www.googleapis.com with drive path', () => {
    expectPatternExists('google-drive');
    const request = makeRequest({
      domain: 'www.googleapis.com',
      path: '/drive/v3/files',
    });
    expect(builtinPatterns['google-drive']!.match(request)).toBe(true);
  });

  it('google-drive scope rejects www.googleapis.com with non-drive path', () => {
    const request = makeRequest({
      domain: 'www.googleapis.com',
      path: '/calendar/v3/calendars',
    });
    expect(builtinPatterns['google-drive']!.match(request)).toBe(false);
  });

  it('google-drive-read-files matches GET to files path', () => {
    expectPatternExists('google-drive-read-files');
    expect(
      builtinPatterns['google-drive-read-files']!.match(
        makeRequest({ method: 'GET', path: '/drive/v3/files' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['google-drive-read-files']!.match(
        makeRequest({ method: 'GET', path: '/drive/v3/about' })
      )
    ).toBe(false);
  });

  it('google-drive-write-comments matches POST to comments path', () => {
    expectPatternExists('google-drive-write-comments');
    expect(
      builtinPatterns['google-drive-write-comments']!.match(
        makeRequest({ method: 'POST', path: '/drive/v3/files/abc123/comments' })
      )
    ).toBe(true);
  });
});

describe('builtin patterns: google-gmail', () => {
  it('google-gmail scope matches gmail.googleapis.com', () => {
    expectPatternExists('google-gmail');
    const request = makeRequest({
      domain: 'gmail.googleapis.com',
      path: '/gmail/v1/users/me/messages',
    });
    expect(builtinPatterns['google-gmail']!.match(request)).toBe(true);
  });

  it('google-gmail scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'mail.google.com' });
    expect(builtinPatterns['google-gmail']!.match(request)).toBe(false);
  });

  it('google-gmail-read-messages matches GET with messages path', () => {
    expectPatternExists('google-gmail-read-messages');
    expect(
      builtinPatterns['google-gmail-read-messages']!.match(
        makeRequest({ method: 'GET', path: '/gmail/v1/users/me/messages' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['google-gmail-read-messages']!.match(
        makeRequest({ method: 'GET', path: '/gmail/v1/users/me/labels' })
      )
    ).toBe(false);
  });

  it('google-gmail-send-messages matches POST to messages/send path', () => {
    expectPatternExists('google-gmail-send-messages');
    expect(
      builtinPatterns['google-gmail-send-messages']!.match(
        makeRequest({ method: 'POST', path: '/gmail/v1/users/me/messages/send' })
      )
    ).toBe(true);
  });

  it('google-gmail-send-messages matches upload variant', () => {
    expect(
      builtinPatterns['google-gmail-send-messages']!.match(
        makeRequest({ method: 'POST', path: '/upload/gmail/v1/users/me/messages/send' })
      )
    ).toBe(true);
  });

  it('google-gmail-write-messages matches upload variant', () => {
    expectPatternExists('google-gmail-write-messages');
    expect(
      builtinPatterns['google-gmail-write-messages']!.match(
        makeRequest({ method: 'POST', path: '/upload/gmail/v1/users/me/messages' })
      )
    ).toBe(true);
  });

  it('google-gmail-write-drafts matches upload variant', () => {
    expectPatternExists('google-gmail-write-drafts');
    expect(
      builtinPatterns['google-gmail-write-drafts']!.match(
        makeRequest({ method: 'POST', path: '/upload/gmail/v1/users/me/drafts' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['google-gmail-write-drafts']!.match(
        makeRequest({ method: 'PUT', path: '/upload/gmail/v1/users/me/drafts/abc123' })
      )
    ).toBe(true);
  });
});

describe('builtin patterns: google-people', () => {
  it('google-people scope matches people.googleapis.com', () => {
    expectPatternExists('google-people');
    const request = makeRequest({
      domain: 'people.googleapis.com',
      path: '/v1/people/me',
    });
    expect(builtinPatterns['google-people']!.match(request)).toBe(true);
  });

  it('google-people scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'contacts.googleapis.com' });
    expect(builtinPatterns['google-people']!.match(request)).toBe(false);
  });

  it('google-people-read-contacts matches GET to people path', () => {
    expectPatternExists('google-people-read-contacts');
    expect(
      builtinPatterns['google-people-read-contacts']!.match(
        makeRequest({ method: 'GET', path: '/v1/people/me/connections' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['google-people-read-contacts']!.match(
        makeRequest({ method: 'GET', path: '/v1/contactGroups' })
      )
    ).toBe(false);
  });

  it('google-people-read-contacts matches GET to colon-method paths', () => {
    expect(
      builtinPatterns['google-people-read-contacts']!.match(
        makeRequest({ method: 'GET', path: '/v1/people:batchGet' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['google-people-read-contacts']!.match(
        makeRequest({ method: 'GET', path: '/v1/people:searchContacts' })
      )
    ).toBe(true);
  });

  it('google-people-write-contacts matches POST to colon-method paths', () => {
    expectPatternExists('google-people-write-contacts');
    expect(
      builtinPatterns['google-people-write-contacts']!.match(
        makeRequest({ method: 'POST', path: '/v1/people:createContact' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['google-people-write-contacts']!.match(
        makeRequest({ method: 'POST', path: '/v1/people:batchDeleteContacts' })
      )
    ).toBe(true);
  });

  it('google-people-read-contact-groups matches GET to colon-method paths', () => {
    expectPatternExists('google-people-read-contact-groups');
    expect(
      builtinPatterns['google-people-read-contact-groups']!.match(
        makeRequest({ method: 'GET', path: '/v1/contactGroups:batchGet' })
      )
    ).toBe(true);
  });

  it('google-people-read-other-contacts matches GET to colon-method paths', () => {
    expectPatternExists('google-people-read-other-contacts');
    expect(
      builtinPatterns['google-people-read-other-contacts']!.match(
        makeRequest({ method: 'GET', path: '/v1/otherContacts:search' })
      )
    ).toBe(true);
  });
});

describe('builtin patterns: google-sheets', () => {
  it('google-sheets scope matches sheets.googleapis.com', () => {
    expectPatternExists('google-sheets');
    const request = makeRequest({
      domain: 'sheets.googleapis.com',
      path: '/v4/spreadsheets/abc123',
    });
    expect(builtinPatterns['google-sheets']!.match(request)).toBe(true);
  });

  it('google-sheets scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'docs.googleapis.com' });
    expect(builtinPatterns['google-sheets']!.match(request)).toBe(false);
  });

  it('google-sheets-read-values matches GET with values path', () => {
    expectPatternExists('google-sheets-read-values');
    expect(
      builtinPatterns['google-sheets-read-values']!.match(
        makeRequest({ method: 'GET', path: '/v4/spreadsheets/abc123/values/Sheet1!A1:B10' })
      )
    ).toBe(true);
  });

  it('google-sheets-create-spreadsheets matches POST to spreadsheets', () => {
    expectPatternExists('google-sheets-create-spreadsheets');
    expect(
      builtinPatterns['google-sheets-create-spreadsheets']!.match(
        makeRequest({ method: 'POST', path: '/v4/spreadsheets' })
      )
    ).toBe(true);
  });
});

describe('builtin patterns: linear', () => {
  it('linear scope matches api.linear.app', () => {
    expectPatternExists('linear');
    const request = makeRequest({ domain: 'api.linear.app', path: '/graphql' });
    expect(builtinPatterns.linear!.match(request)).toBe(true);
  });

  it('linear scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'linear.example.com' });
    expect(builtinPatterns.linear!.match(request)).toBe(false);
  });
});

describe('builtin patterns: mailchimp', () => {
  it('mailchimp scope matches the mailchimp API domain', () => {
    expectPatternExists('mailchimp');
    const request = makeRequest({
      domain: 'server.api.mailchimp.com',
      path: '/3.0/campaigns',
    });
    expect(builtinPatterns.mailchimp!.match(request)).toBe(true);
  });

  it('mailchimp-read-campaigns matches GET to campaigns path', () => {
    expectPatternExists('mailchimp-read-campaigns');
    expect(
      builtinPatterns['mailchimp-read-campaigns']!.match(
        makeRequest({ method: 'GET', path: '/3.0/campaigns' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['mailchimp-read-campaigns']!.match(
        makeRequest({ method: 'GET', path: '/3.0/lists' })
      )
    ).toBe(false);
  });

  it('mailchimp-write-lists matches POST to lists path', () => {
    expectPatternExists('mailchimp-write-lists');
    expect(
      builtinPatterns['mailchimp-write-lists']!.match(
        makeRequest({ method: 'POST', path: '/3.0/lists' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['mailchimp-write-lists']!.match(
        makeRequest({ method: 'POST', path: '/3.0/campaigns' })
      )
    ).toBe(false);
  });
});

describe('builtin patterns: notion', () => {
  it('notion scope matches api.notion.com', () => {
    expectPatternExists('notion');
    const request = makeRequest({ domain: 'api.notion.com', path: '/v1/pages' });
    expect(builtinPatterns.notion!.match(request)).toBe(true);
  });

  it('notion scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'notion.example.com' });
    expect(builtinPatterns.notion!.match(request)).toBe(false);
  });

  it('notion-read-pages matches GET to /v1/pages path', () => {
    expectPatternExists('notion-read-pages');
    expect(
      builtinPatterns['notion-read-pages']!.match(
        makeRequest({ method: 'GET', path: '/v1/pages/abc123' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['notion-read-pages']!.match(
        makeRequest({ method: 'GET', path: '/v1/databases/abc123' })
      )
    ).toBe(false);
  });

  it('notion-search matches POST to /v1/search', () => {
    expectPatternExists('notion-search');
    expect(
      builtinPatterns['notion-search']!.match(makeRequest({ method: 'POST', path: '/v1/search' }))
    ).toBe(true);
    expect(
      builtinPatterns['notion-search']!.match(makeRequest({ method: 'POST', path: '/v1/pages' }))
    ).toBe(false);
  });
});

describe('builtin patterns: sentry', () => {
  it('sentry scope matches sentry.io', () => {
    expectPatternExists('sentry');
    const request = makeRequest({
      domain: 'sentry.io',
      path: '/api/0/organizations/my-org/issues/',
    });
    expect(builtinPatterns.sentry!.match(request)).toBe(true);
  });

  it('sentry scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'sentry.example.com' });
    expect(builtinPatterns.sentry!.match(request)).toBe(false);
  });

  it('sentry-read-issues matches GET with issues path', () => {
    expectPatternExists('sentry-read-issues');
    expect(
      builtinPatterns['sentry-read-issues']!.match(
        makeRequest({ method: 'GET', path: '/api/0/organizations/my-org/issues/' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['sentry-read-issues']!.match(
        makeRequest({ method: 'GET', path: '/api/0/organizations/my-org/releases/' })
      )
    ).toBe(false);
  });

  it('sentry-write-projects matches POST to projects path', () => {
    expectPatternExists('sentry-write-projects');
    expect(
      builtinPatterns['sentry-write-projects']!.match(
        makeRequest({ method: 'POST', path: '/api/0/teams/my-org/my-team/projects/' })
      )
    ).toBe(true);
  });
});

describe('builtin patterns: slack', () => {
  it('slack scope matches slack.com', () => {
    expectPatternExists('slack');
    const request = makeRequest({
      domain: 'slack.com',
      path: '/api/chat.postMessage',
    });
    expect(builtinPatterns.slack!.match(request)).toBe(true);
  });

  it('slack scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'slack.example.com' });
    expect(builtinPatterns.slack!.match(request)).toBe(false);
  });

  it('slack-chat matches chat method paths but not conversations', () => {
    expectPatternExists('slack-chat');
    expect(
      builtinPatterns['slack-chat']!.match(makeRequest({ path: '/api/chat.postMessage' }))
    ).toBe(true);
    expect(
      builtinPatterns['slack-chat']!.match(makeRequest({ path: '/api/conversations.list' }))
    ).toBe(false);
  });

  it('slack-users matches users method paths but not chat', () => {
    expectPatternExists('slack-users');
    expect(builtinPatterns['slack-users']!.match(makeRequest({ path: '/api/users.list' }))).toBe(
      true
    );
    expect(
      builtinPatterns['slack-users']!.match(makeRequest({ path: '/api/chat.postMessage' }))
    ).toBe(false);
  });
});

describe('builtin patterns: stripe', () => {
  it('stripe scope matches api.stripe.com', () => {
    expectPatternExists('stripe');
    const request = makeRequest({
      domain: 'api.stripe.com',
      path: '/v1/charges',
    });
    expect(builtinPatterns.stripe!.match(request)).toBe(true);
  });

  it('stripe scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'stripe.example.com' });
    expect(builtinPatterns.stripe!.match(request)).toBe(false);
  });

  it('stripe-read-customers matches GET to /v1/customers path', () => {
    expectPatternExists('stripe-read-customers');
    expect(
      builtinPatterns['stripe-read-customers']!.match(
        makeRequest({ method: 'GET', path: '/v1/customers' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['stripe-read-customers']!.match(
        makeRequest({ method: 'GET', path: '/v1/products' })
      )
    ).toBe(false);
  });

  it('stripe-write-payments matches POST to payment_intents path', () => {
    expectPatternExists('stripe-write-payments');
    expect(
      builtinPatterns['stripe-write-payments']!.match(
        makeRequest({ method: 'POST', path: '/v1/payment_intents' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['stripe-write-payments']!.match(
        makeRequest({ method: 'POST', path: '/v1/customers' })
      )
    ).toBe(false);
  });
});

describe('builtin patterns: telegram', () => {
  it('telegram scope matches api.telegram.org', () => {
    expectPatternExists('telegram');
    const request = makeRequest({
      domain: 'api.telegram.org',
      path: '/bot123456:ABC-DEF/sendMessage',
    });
    expect(builtinPatterns.telegram!.match(request)).toBe(true);
  });

  it('telegram scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'telegram.example.com' });
    expect(builtinPatterns.telegram!.match(request)).toBe(false);
  });

  it('telegram-send-messages matches sendMessage paths', () => {
    expectPatternExists('telegram-send-messages');
    const request = makeRequest({ path: '/bot123456:ABC-DEF/sendMessage' });
    expect(builtinPatterns['telegram-send-messages']!.match(request)).toBe(true);
  });

  it('telegram-updates matches getUpdates path', () => {
    expectPatternExists('telegram-updates');
    expect(
      builtinPatterns['telegram-updates']!.match(
        makeRequest({ path: '/bot123456:ABC-DEF/getUpdates' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['telegram-updates']!.match(
        makeRequest({ path: '/bot123456:ABC-DEF/sendMessage' })
      )
    ).toBe(false);
  });
});

describe('builtin patterns: umami', () => {
  it('umami scope matches the umami API domain', () => {
    expectPatternExists('umami');
    const request = makeRequest({
      domain: 'api.umami.is',
      path: '/api/websites',
    });
    expect(builtinPatterns.umami!.match(request)).toBe(true);
  });

  it('umami-read-websites matches cloud /v1/websites path', () => {
    expectPatternExists('umami-read-websites');
    expect(
      builtinPatterns['umami-read-websites']!.match(
        makeRequest({ method: 'GET', path: '/v1/websites' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['umami-read-websites']!.match(
        makeRequest({ method: 'GET', path: '/v1/teams' })
      )
    ).toBe(false);
  });

  it('umami-read-websites matches self-hosted /api/websites path', () => {
    expectPatternExists('umami-read-websites');
    expect(
      builtinPatterns['umami-read-websites']!.match(
        makeRequest({ method: 'GET', path: '/api/websites' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['umami-read-websites']!.match(
        makeRequest({ method: 'GET', path: '/api/teams' })
      )
    ).toBe(false);
  });

  it('umami-write-teams matches both cloud and self-hosted paths', () => {
    expectPatternExists('umami-write-teams');
    expect(
      builtinPatterns['umami-write-teams']!.match(
        makeRequest({ method: 'POST', path: '/v1/teams' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['umami-write-teams']!.match(
        makeRequest({ method: 'POST', path: '/api/teams' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['umami-write-teams']!.match(
        makeRequest({ method: 'POST', path: '/api/websites' })
      )
    ).toBe(false);
  });
});

describe('builtin patterns: yelp', () => {
  it('yelp scope matches api.yelp.com', () => {
    expectPatternExists('yelp');
    const request = makeRequest({
      domain: 'api.yelp.com',
      path: '/v3/businesses/search',
    });
    expect(builtinPatterns.yelp!.match(request)).toBe(true);
  });

  it('yelp scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'yelp.example.com' });
    expect(builtinPatterns.yelp!.match(request)).toBe(false);
  });

  it('yelp-read-businesses matches GET to /v3/businesses path', () => {
    expectPatternExists('yelp-read-businesses');
    expect(
      builtinPatterns['yelp-read-businesses']!.match(
        makeRequest({ method: 'GET', path: '/v3/businesses/search' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['yelp-read-businesses']!.match(
        makeRequest({ method: 'GET', path: '/v3/events' })
      )
    ).toBe(false);
  });

  it('yelp-autocomplete matches /v3/autocomplete path', () => {
    expectPatternExists('yelp-autocomplete');
    expect(
      builtinPatterns['yelp-autocomplete']!.match(
        makeRequest({ method: 'GET', path: '/v3/autocomplete' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['yelp-autocomplete']!.match(
        makeRequest({ method: 'GET', path: '/v3/businesses/search' })
      )
    ).toBe(false);
  });
});

describe('builtin patterns: zoom', () => {
  it('zoom scope matches api.zoom.us', () => {
    expectPatternExists('zoom');
    const request = makeRequest({
      domain: 'api.zoom.us',
      path: '/v2/users/me/meetings',
    });
    expect(builtinPatterns.zoom!.match(request)).toBe(true);
  });

  it('zoom scope rejects unrelated domains', () => {
    const request = makeRequest({ domain: 'zoom.example.com' });
    expect(builtinPatterns.zoom!.match(request)).toBe(false);
  });

  it('zoom-read-meetings matches GET to meetings path', () => {
    expectPatternExists('zoom-read-meetings');
    expect(
      builtinPatterns['zoom-read-meetings']!.match(
        makeRequest({ method: 'GET', path: '/v2/meetings/123456' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['zoom-read-meetings']!.match(
        makeRequest({ method: 'GET', path: '/v2/users/me' })
      )
    ).toBe(false);
  });

  it('zoom-write-recordings matches DELETE to recordings path', () => {
    expectPatternExists('zoom-write-recordings');
    expect(
      builtinPatterns['zoom-write-recordings']!.match(
        makeRequest({ method: 'DELETE', path: '/v2/meetings/123456/recordings' })
      )
    ).toBe(true);
    expect(
      builtinPatterns['zoom-write-recordings']!.match(
        makeRequest({ method: 'DELETE', path: '/v2/meetings/123456' })
      )
    ).toBe(false);
  });
});
