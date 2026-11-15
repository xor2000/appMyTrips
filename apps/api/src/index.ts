import { Hono } from 'hono';
import { accessAuth, type AuthEnv } from './auth';

const app = new Hono<AuthEnv>().basePath('/api');

// Route publique : sonde de disponibilité.
app.get('/health', (c) => c.json({ ok: true }));

// Toutes les autres routes /api/* exigent une identité Cloudflare Access.
app.use('*', accessAuth());

app.get('/me', (c) => c.json({ email: c.get('userEmail') }));

export default app;
