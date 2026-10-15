// Hosted authentication acceptance check. Usage:
//   read -rs HOSTED_PASSWORD && export HOSTED_PASSWORD
//   HOSTED_URL=https://staging-badminton-youtube-uploader.<subdomain>.workers.dev node scripts/hosted-auth-check.mjs
// The final steps deliberately fail five logins, so run this only against staging.
const baseUrl = process.env.HOSTED_URL?.replace(/\/$/, '');
const password = process.env.HOSTED_PASSWORD;
if (!baseUrl || !password) {
  console.error('Set HOSTED_URL and HOSTED_PASSWORD.');
  process.exit(2);
}

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};

const request = (path, { method = 'GET', cookie, body } = {}) =>
  fetch(`${baseUrl}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

const login = (candidate) =>
  request('/api/login', { method: 'POST', body: { password: candidate } });
const sessionCookie = (response) => response.headers.get('set-cookie')?.split(';')[0];

const health = await request('/api/health');
check('health is 200', health.status === 200, health.status);
const root = await request('/');
check('root is 200', root.status === 200, root.status);
const anonymous = await request('/api/session');
check('protected API is 401 without a session', anonymous.status === 401, anonymous.status);

const started = await login(password);
const cookie = sessionCookie(started);
check('login with the shared password succeeds', started.status === 200, started.status);
const attributes = started.headers.get('set-cookie') ?? '';
check(
  'session cookie is HttpOnly and Secure',
  /httponly/i.test(attributes) && /secure/i.test(attributes),
);
check('session cookie is persistent (Max-Age or Expires)', /max-age|expires/i.test(attributes));

if (cookie) {
  const session = await request('/api/session', { cookie });
  const state = await session.json().catch(() => ({}));
  check('session is accepted', session.status === 200, session.status);
  check('publisher is live', state.publisherMode === 'live', state.publisherMode);
  check('audit approval is disabled', state.auditApproved === false, String(state.auditApproved));

  const loggedOut = await request('/api/logout', { method: 'POST', cookie });
  check('logout succeeds', loggedOut.status === 200, loggedOut.status);
  const revoked = await request('/api/session', { cookie });
  check('logged-out session is revoked', revoked.status === 401, revoked.status);
}

let limited;
for (let attempt = 1; attempt <= 6; attempt += 1) {
  const response = await login(`wrong-${attempt}-${Date.now()}`);
  if (attempt <= 5) {
    check(`failed login ${attempt} is 401`, response.status === 401, response.status);
  } else {
    limited = response;
  }
}
check('sixth attempt is 429', limited?.status === 429, limited?.status);
const retryAfter = Number(limited?.headers.get('retry-after'));
check('429 carries Retry-After', Number.isFinite(retryAfter) && retryAfter > 0, retryAfter);

if (Number.isFinite(retryAfter) && retryAfter > 0) {
  console.log(`Waiting ${retryAfter + 2}s for the throttle window to clear...`);
  await new Promise((resolve) => setTimeout(resolve, (retryAfter + 2) * 1000));
  const recovered = await login(password);
  check('login works again after the window', recovered.status === 200, recovered.status);
  const recoveredCookie = sessionCookie(recovered);
  if (recoveredCookie) await request('/api/logout', { method: 'POST', cookie: recoveredCookie });
}

console.log(failures === 0 ? '\nAll hosted auth checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
