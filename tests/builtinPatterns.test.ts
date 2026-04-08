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

  it('calendly-read-all matches GET requests', () => {
    expectPatternExists('calendly-read-all');
    const get = makeRequest({ method: 'GET' });
    const post = makeRequest({ method: 'POST' });
    expect(builtinPatterns['calendly-read-all']!.match(get)).toBe(true);
    expect(builtinPatterns['calendly-read-all']!.match(post)).toBe(false);
  });

  it('calendly-write-all matches POST but not GET', () => {
    expectPatternExists('calendly-write-all');
    const post = makeRequest({ method: 'POST' });
    const get = makeRequest({ method: 'GET' });
    expect(builtinPatterns['calendly-write-all']!.match(post)).toBe(true);
    expect(builtinPatterns['calendly-write-all']!.match(get)).toBe(false);
  });
});

describe('builtin patterns: coolify', () => {
  it('coolify scope matches the coolify API domain', () => {
    expectPatternExists('coolify');
    // Coolify is self-hosted; the scope pattern should match the relevant domain or path
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

  it('discord-read-all matches GET requests', () => {
    expectPatternExists('discord-read-all');
    const get = makeRequest({ method: 'GET' });
    expect(builtinPatterns['discord-read-all']!.match(get)).toBe(true);
    expect(builtinPatterns['discord-read-all']!.match(makeRequest({ method: 'DELETE' }))).toBe(
      false
    );
  });

  it('discord-write-all matches POST and rejects GET', () => {
    expectPatternExists('discord-write-all');
    expect(builtinPatterns['discord-write-all']!.match(makeRequest({ method: 'POST' }))).toBe(true);
    expect(builtinPatterns['discord-write-all']!.match(makeRequest({ method: 'GET' }))).toBe(false);
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

  it('dropbox-files-write matches write paths like upload', () => {
    expectPatternExists('dropbox-files-write');
    expect(
      builtinPatterns['dropbox-files-write']!.match(makeRequest({ path: '/2/files/upload' }))
    ).toBe(true);
    expect(
      builtinPatterns['dropbox-files-write']!.match(
        makeRequest({ path: '/2/files/list_folder' })
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

  it('figma-read-all accepts GET and rejects POST', () => {
    expectPatternExists('figma-read-all');
    expect(builtinPatterns['figma-read-all']!.match(makeRequest({ method: 'GET' }))).toBe(true);
    expect(builtinPatterns['figma-read-all']!.match(makeRequest({ method: 'POST' }))).toBe(false);
  });

  it('figma-write-all accepts DELETE and rejects GET', () => {
    expectPatternExists('figma-write-all');
    expect(builtinPatterns['figma-write-all']!.match(makeRequest({ method: 'DELETE' }))).toBe(true);
    expect(builtinPatterns['figma-write-all']!.match(makeRequest({ method: 'GET' }))).toBe(false);
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

  it('github-read-all matches GET and rejects PUT', () => {
    expectPatternExists('github-read-all');
    expect(builtinPatterns['github-read-all']!.match(makeRequest({ method: 'GET' }))).toBe(true);
    expect(builtinPatterns['github-read-all']!.match(makeRequest({ method: 'PUT' }))).toBe(false);
  });

  it('github-write-all matches PATCH and rejects GET', () => {
    expectPatternExists('github-write-all');
    expect(builtinPatterns['github-write-all']!.match(makeRequest({ method: 'PATCH' }))).toBe(true);
    expect(builtinPatterns['github-write-all']!.match(makeRequest({ method: 'GET' }))).toBe(false);
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

  it('gitlab-read-all matches GET requests', () => {
    expectPatternExists('gitlab-read-all');
    expect(builtinPatterns['gitlab-read-all']!.match(makeRequest({ method: 'GET' }))).toBe(true);
  });

  it('gitlab-write-all rejects GET and accepts POST', () => {
    expectPatternExists('gitlab-write-all');
    expect(builtinPatterns['gitlab-write-all']!.match(makeRequest({ method: 'GET' }))).toBe(false);
    expect(builtinPatterns['gitlab-write-all']!.match(makeRequest({ method: 'POST' }))).toBe(true);
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

  it('google-analytics-read-all matches GET requests', () => {
    expectPatternExists('google-analytics-read-all');
    expect(
      builtinPatterns['google-analytics-read-all']!.match(makeRequest({ method: 'GET' }))
    ).toBe(true);
    expect(
      builtinPatterns['google-analytics-read-all']!.match(makeRequest({ method: 'POST' }))
    ).toBe(false);
  });

  it('google-analytics-write-all matches DELETE and rejects GET', () => {
    expectPatternExists('google-analytics-write-all');
    expect(
      builtinPatterns['google-analytics-write-all']!.match(makeRequest({ method: 'DELETE' }))
    ).toBe(true);
    expect(
      builtinPatterns['google-analytics-write-all']!.match(makeRequest({ method: 'GET' }))
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

  it('google-calendar-read-all matches GET requests', () => {
    expectPatternExists('google-calendar-read-all');
    expect(builtinPatterns['google-calendar-read-all']!.match(makeRequest({ method: 'GET' }))).toBe(
      true
    );
  });

  it('google-calendar-write-all rejects GET', () => {
    expectPatternExists('google-calendar-write-all');
    expect(
      builtinPatterns['google-calendar-write-all']!.match(makeRequest({ method: 'GET' }))
    ).toBe(false);
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

  it('google-docs-read-all matches GET', () => {
    expectPatternExists('google-docs-read-all');
    expect(builtinPatterns['google-docs-read-all']!.match(makeRequest({ method: 'GET' }))).toBe(
      true
    );
  });

  it('google-docs-write-all accepts POST and rejects GET', () => {
    expectPatternExists('google-docs-write-all');
    expect(builtinPatterns['google-docs-write-all']!.match(makeRequest({ method: 'POST' }))).toBe(
      true
    );
    expect(builtinPatterns['google-docs-write-all']!.match(makeRequest({ method: 'GET' }))).toBe(
      false
    );
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

  it('google-drive-read-all matches GET requests', () => {
    expectPatternExists('google-drive-read-all');
    expect(builtinPatterns['google-drive-read-all']!.match(makeRequest({ method: 'GET' }))).toBe(
      true
    );
  });

  it('google-drive-write-all rejects GET requests', () => {
    expectPatternExists('google-drive-write-all');
    expect(builtinPatterns['google-drive-write-all']!.match(makeRequest({ method: 'GET' }))).toBe(
      false
    );
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

  it('google-gmail-read-all matches GET', () => {
    expectPatternExists('google-gmail-read-all');
    expect(builtinPatterns['google-gmail-read-all']!.match(makeRequest({ method: 'GET' }))).toBe(
      true
    );
  });

  it('google-gmail-write-all accepts PUT and rejects GET', () => {
    expectPatternExists('google-gmail-write-all');
    expect(builtinPatterns['google-gmail-write-all']!.match(makeRequest({ method: 'PUT' }))).toBe(
      true
    );
    expect(builtinPatterns['google-gmail-write-all']!.match(makeRequest({ method: 'GET' }))).toBe(
      false
    );
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

  it('google-people-read-all matches GET requests', () => {
    expectPatternExists('google-people-read-all');
    expect(builtinPatterns['google-people-read-all']!.match(makeRequest({ method: 'GET' }))).toBe(
      true
    );
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

  it('google-sheets-read-all matches GET requests', () => {
    expectPatternExists('google-sheets-read-all');
    expect(builtinPatterns['google-sheets-read-all']!.match(makeRequest({ method: 'GET' }))).toBe(
      true
    );
  });

  it('google-sheets-write-all accepts PUT and rejects GET', () => {
    expectPatternExists('google-sheets-write-all');
    expect(builtinPatterns['google-sheets-write-all']!.match(makeRequest({ method: 'PUT' }))).toBe(
      true
    );
    expect(builtinPatterns['google-sheets-write-all']!.match(makeRequest({ method: 'GET' }))).toBe(
      false
    );
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

  it('mailchimp-read-all matches GET requests', () => {
    expectPatternExists('mailchimp-read-all');
    expect(builtinPatterns['mailchimp-read-all']!.match(makeRequest({ method: 'GET' }))).toBe(true);
  });

  it('mailchimp-write-all accepts DELETE and rejects GET', () => {
    expectPatternExists('mailchimp-write-all');
    expect(builtinPatterns['mailchimp-write-all']!.match(makeRequest({ method: 'DELETE' }))).toBe(
      true
    );
    expect(builtinPatterns['mailchimp-write-all']!.match(makeRequest({ method: 'GET' }))).toBe(
      false
    );
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

  it('notion-read-all matches GET requests', () => {
    expectPatternExists('notion-read-all');
    expect(builtinPatterns['notion-read-all']!.match(makeRequest({ method: 'GET' }))).toBe(true);
  });

  it('notion-write-all accepts PATCH and rejects GET', () => {
    expectPatternExists('notion-write-all');
    expect(builtinPatterns['notion-write-all']!.match(makeRequest({ method: 'PATCH' }))).toBe(true);
    expect(builtinPatterns['notion-write-all']!.match(makeRequest({ method: 'GET' }))).toBe(false);
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

  it('sentry-read-all matches GET requests', () => {
    expectPatternExists('sentry-read-all');
    expect(builtinPatterns['sentry-read-all']!.match(makeRequest({ method: 'GET' }))).toBe(true);
    expect(builtinPatterns['sentry-read-all']!.match(makeRequest({ method: 'PUT' }))).toBe(false);
  });

  it('sentry-write-all accepts POST and rejects GET', () => {
    expectPatternExists('sentry-write-all');
    expect(builtinPatterns['sentry-write-all']!.match(makeRequest({ method: 'POST' }))).toBe(true);
    expect(builtinPatterns['sentry-write-all']!.match(makeRequest({ method: 'GET' }))).toBe(false);
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

  it('slack-chat matches chat-related API paths', () => {
    expectPatternExists('slack-chat');
    const request = makeRequest({ path: '/api/chat.postMessage' });
    expect(builtinPatterns['slack-chat']!.match(request)).toBe(true);
  });

  it('slack-conversations matches conversations-related API paths', () => {
    expectPatternExists('slack-conversations');
    const request = makeRequest({ path: '/api/conversations.list' });
    expect(builtinPatterns['slack-conversations']!.match(request)).toBe(true);
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

  it('stripe-read-all matches GET and rejects POST', () => {
    expectPatternExists('stripe-read-all');
    expect(builtinPatterns['stripe-read-all']!.match(makeRequest({ method: 'GET' }))).toBe(true);
    expect(builtinPatterns['stripe-read-all']!.match(makeRequest({ method: 'POST' }))).toBe(false);
  });

  it('stripe-write-all accepts POST and rejects GET', () => {
    expectPatternExists('stripe-write-all');
    expect(builtinPatterns['stripe-write-all']!.match(makeRequest({ method: 'POST' }))).toBe(true);
    expect(builtinPatterns['stripe-write-all']!.match(makeRequest({ method: 'GET' }))).toBe(false);
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

  it('umami-read-all matches GET requests', () => {
    expectPatternExists('umami-read-all');
    expect(builtinPatterns['umami-read-all']!.match(makeRequest({ method: 'GET' }))).toBe(true);
    expect(builtinPatterns['umami-read-all']!.match(makeRequest({ method: 'POST' }))).toBe(false);
  });

  it('umami-write-all matches POST and rejects GET', () => {
    expectPatternExists('umami-write-all');
    expect(builtinPatterns['umami-write-all']!.match(makeRequest({ method: 'POST' }))).toBe(true);
    expect(builtinPatterns['umami-write-all']!.match(makeRequest({ method: 'GET' }))).toBe(false);
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

  it('yelp-read-all matches GET requests', () => {
    expectPatternExists('yelp-read-all');
    expect(builtinPatterns['yelp-read-all']!.match(makeRequest({ method: 'GET' }))).toBe(true);
  });

  it('yelp-write-all rejects GET', () => {
    expectPatternExists('yelp-write-all');
    expect(builtinPatterns['yelp-write-all']!.match(makeRequest({ method: 'GET' }))).toBe(false);
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

  it('zoom-read-all matches GET and rejects DELETE', () => {
    expectPatternExists('zoom-read-all');
    expect(builtinPatterns['zoom-read-all']!.match(makeRequest({ method: 'GET' }))).toBe(true);
    expect(builtinPatterns['zoom-read-all']!.match(makeRequest({ method: 'DELETE' }))).toBe(false);
  });

  it('zoom-write-all accepts PUT and rejects GET', () => {
    expectPatternExists('zoom-write-all');
    expect(builtinPatterns['zoom-write-all']!.match(makeRequest({ method: 'PUT' }))).toBe(true);
    expect(builtinPatterns['zoom-write-all']!.match(makeRequest({ method: 'GET' }))).toBe(false);
  });
});
