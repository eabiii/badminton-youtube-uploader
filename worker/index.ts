import { Hono } from 'hono';
import { z } from 'zod';
import {
  loginRequestSchema,
  playerMergeSchema,
  playerMutationSchema,
  queuingEntryMutationSchema,
} from '../shared/domain';
import { createSession, requireSession, revokeSession, sha256, verifyPassword } from './auth';
import type { Bindings } from './env';
import { LoginThrottle } from './login-throttle';
import { PlayerDirectory, PlayerDirectoryError } from './players';
import { QueuingDirectory, QueuingDirectoryError } from './queuing-entries';
import { UploadCoordinator, UploadError } from './upload/coordinator';
import { FakeYouTubePublisher } from './upload/fake-publisher';
import { D1LeaseRepository } from './upload/lease-repository';
import type { YouTubePublisher } from './upload/publisher';
import { LiveYouTubePublisher } from './upload/youtube-publisher';

type Variables = { sessionHash: string };
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const fakePublisher = new FakeYouTubePublisher();

function publisherFor(env: Bindings): YouTubePublisher {
  return env.YOUTUBE_MODE === 'live' ? new LiveYouTubePublisher(env) : fakePublisher;
}

function coordinatorFor(env: Bindings): UploadCoordinator {
  return new UploadCoordinator(
    new D1LeaseRepository(env.DB),
    publisherFor(env),
    env.YOUTUBE_AUDIT_APPROVED === 'true',
  );
}

app.use('/api/*', async (context, next) => {
  await next();
  context.header('cache-control', 'no-store');
  context.header('x-content-type-options', 'nosniff');
});

app.post('/api/login', async (context) => {
  const clientHash = await sha256(context.req.header('CF-Connecting-IP') ?? 'local');
  const throttle = new LoginThrottle(context.env.DB);
  const retryAfter = await throttle.retryAfter(clientHash);
  if (retryAfter !== null) {
    context.header('Retry-After', String(retryAfter));
    return context.json({ error: 'Too many failed sign-in attempts. Try again later.' }, 429);
  }
  const body = loginRequestSchema.safeParse(await context.req.json().catch(() => null));
  if (
    !body.success ||
    !(await verifyPassword(body.data.password, context.env.SHARED_PASSWORD_HASH))
  ) {
    await throttle.failed(clientHash);
    return context.json({ error: 'The shared password is incorrect.' }, 401);
  }
  await throttle.reset(clientHash);
  await createSession(context);
  return context.json({ authenticated: true });
});

app.use('/api/session', requireSession);
app.use('/api/logout', requireSession);
app.use('/api/upload/*', requireSession);
app.use('/api/players', requireSession);
app.use('/api/players/*', requireSession);
app.use('/api/queuing-entries', requireSession);
app.use('/api/queuing-entries/*', requireSession);

app.get('/api/session', (context) =>
  context.json({
    authenticated: true,
    auditApproved: context.env.YOUTUBE_AUDIT_APPROVED === 'true',
    publisherMode: context.env.YOUTUBE_MODE,
  }),
);

app.post('/api/logout', async (context) => {
  await revokeSession(context);
  return context.json({ authenticated: false });
});

app.get('/api/players', async (context) => {
  return context.json({ players: await new PlayerDirectory(context.env.DB).list() });
});

app.post('/api/players', async (context) => {
  const body = playerMutationSchema.parse(await context.req.json().catch(() => null));
  return context.json(await new PlayerDirectory(context.env.DB).add(body.displayName), 201);
});

app.patch('/api/players/:id', async (context) => {
  const body = playerMutationSchema.parse(await context.req.json().catch(() => null));
  return context.json(
    await new PlayerDirectory(context.env.DB).rename(context.req.param('id'), body.displayName),
  );
});

app.post('/api/players/:sourceId/merge', async (context) => {
  const body = playerMergeSchema.parse(await context.req.json().catch(() => null));
  return context.json(
    await new PlayerDirectory(context.env.DB).merge(
      context.req.param('sourceId'),
      body.targetPlayerId,
    ),
  );
});

app.delete('/api/players/:id', async (context) => {
  await new PlayerDirectory(context.env.DB).remove(context.req.param('id'));
  return context.body(null, 204);
});

app.get('/api/queuing-entries', async (context) => {
  return context.json({
    queuingEntries: await new QueuingDirectory(context.env.DB).list(),
  });
});

app.post('/api/queuing-entries', async (context) => {
  const body = queuingEntryMutationSchema.parse(await context.req.json().catch(() => null));
  return context.json(await new QueuingDirectory(context.env.DB).add(body), 201);
});

app.patch('/api/queuing-entries/:id', async (context) => {
  const body = queuingEntryMutationSchema.parse(await context.req.json().catch(() => null));
  return context.json(
    await new QueuingDirectory(context.env.DB).update(context.req.param('id'), body),
  );
});

app.delete('/api/queuing-entries/:id', async (context) => {
  await new QueuingDirectory(context.env.DB).remove(context.req.param('id'));
  return context.body(null, 204);
});

app.get('/api/upload/status', async (context) => {
  return context.json(await coordinatorFor(context.env).status(context.get('sessionHash')));
});

app.post('/api/upload/start', async (context) => {
  return context.json(
    await coordinatorFor(context.env).start(context.get('sessionHash'), await context.req.json()),
    201,
  );
});

app.post('/api/upload/:leaseId/heartbeat', async (context) => {
  await coordinatorFor(context.env).heartbeat(
    context.get('sessionHash'),
    context.req.param('leaseId'),
  );
  return context.body(null, 204);
});

app.put('/api/upload/:leaseId/chunk', async (context) => {
  const start = Number(context.req.header('x-upload-offset'));
  if (!Number.isSafeInteger(start) || start < 0)
    return context.json({ error: 'A valid upload offset is required.' }, 400);
  const result = await coordinatorFor(context.env).uploadChunk(
    context.get('sessionHash'),
    context.req.param('leaseId'),
    start,
    await context.req.arrayBuffer(),
  );
  return context.json(result);
});

app.post('/api/upload/:leaseId/retry-playlist', async (context) => {
  return context.json(
    await coordinatorFor(context.env).retryPlaylist(
      context.get('sessionHash'),
      context.req.param('leaseId'),
    ),
  );
});

app.post('/api/upload/:leaseId/cancel', async (context) => {
  await coordinatorFor(context.env).cancel(
    context.get('sessionHash'),
    context.req.param('leaseId'),
  );
  return context.body(null, 204);
});

app.post('/api/upload/:leaseId/accept-partial-success', async (context) => {
  await coordinatorFor(context.env).acceptPartialSuccess(
    context.get('sessionHash'),
    context.req.param('leaseId'),
  );
  return context.body(null, 204);
});

app.onError((error, context) => {
  if (error instanceof UploadError) {
    return context.json({ error: error.message, offset: error.offset }, error.status);
  }
  if (error instanceof PlayerDirectoryError)
    return context.json({ error: error.message }, error.status);
  if (error instanceof QueuingDirectoryError)
    return context.json({ error: error.message }, error.status);
  if (error instanceof z.ZodError)
    return context.json({ error: error.issues[0]?.message ?? 'Invalid request.' }, 400);
  return context.json({ error: 'The server could not complete the request.' }, 500);
});

app.all('*', (context) => context.env.ASSETS.fetch(context.req.raw));

export default app;
