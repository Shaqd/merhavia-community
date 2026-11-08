import { Hono } from 'hono';
import { health } from './health';

// Only /api/* reaches the Worker; every other path serves the React app (see wrangler.jsonc).
const app = new Hono<{ Bindings: Env }>().basePath('/api');

app.route('/health', health);

export default app;
