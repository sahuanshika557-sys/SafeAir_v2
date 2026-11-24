import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ServerApiRequest, ServerApiResponse } from './src/server/apiHandlers.js';
import { getServerPort } from './src/server/env.js';

const TS_EXTENSION_SLICE = -3;
const HTTP_OK = 200;

// Allow running `node server.ts` directly via Node 22 native TypeScript support even when
// relative imports use standard ESM `.js` extensions required by Vercel's Node builder.
if (typeof registerHooks === 'function') {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (
        (specifier.startsWith('./') || specifier.startsWith('../')) &&
        specifier.endsWith('.js') &&
        context.parentURL?.startsWith('file://') &&
        !context.parentURL.includes('/node_modules/')
      ) {
        const tsUrl = new URL(`${specifier.slice(0, TS_EXTENSION_SLICE)}.ts`, context.parentURL);
        if (!fs.existsSync(new URL(specifier, context.parentURL)) && fs.existsSync(tsUrl)) {
          return nextResolve(tsUrl.href, context);
        }
      }
      return nextResolve(specifier, context);
    },
  });
}

const PORT = getServerPort();

function applyAppSecurityHeaders(res: Response, isProd: boolean): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  if (isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://air-quality-api.open-meteo.com https://geocoding-api.open-meteo.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
    );
  }
}

async function mountFrontendMiddleware(
  app: express.Express,
  projectRoot: string,
  isProd: boolean,
): Promise<void> {
  if (isProd) {
    const distPath = path.resolve(projectRoot, 'dist');
    const indexHtmlPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexHtmlPath)) {
      throw new Error('Production build missing. Run `npm run build` before `npm start`.');
    }
    app.use(express.static(distPath, { dotfiles: 'ignore', maxAge: '1h' }));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(indexHtmlPath);
    });
    return;
  }

  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
  app.get('*', async (req: Request, res: Response, next) => {
    try {
      const html = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf-8');
      const transformed = await vite.transformIndexHtml(req.originalUrl, html);
      res.status(HTTP_OK).set({ 'Content-Type': 'text/html' }).end(transformed);
    } catch (err) {
      next(err);
    }
  });
}

async function startServer(): Promise<void> {
  const {
    handleAqiRequest,
    handleChatRequest,
    handleGeocodeRequest,
    handleHealthRequest,
    handlePlanRequest,
    handleReverseGeocodeRequest,
  } = await import('./src/server/apiHandlers.js');

  const app = express();
  app.disable('x-powered-by');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot =
    path.basename(__dirname) === 'dist-server' ? path.resolve(__dirname, '..') : __dirname;
  const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');

  app.use((_req, res, next) => {
    applyAppSecurityHeaders(res, isProd);
    next();
  });
  app.use(express.json({ limit: '32kb' }));

  const apiRoutes: ReadonlyArray<
    readonly [string, (req: ServerApiRequest, res: ServerApiResponse) => Promise<void>]
  > = [
    ['/api/health', handleHealthRequest],
    ['/api/geocode', handleGeocodeRequest],
    ['/api/reverse-geocode', handleReverseGeocodeRequest],
    ['/api/aqi', handleAqiRequest],
    ['/api/plan', handlePlanRequest],
    ['/api/chat', handleChatRequest],
  ];

  for (const [routePath, handler] of apiRoutes) {
    app.all(routePath, (req: Request, res: Response): void => {
      void handler(req, res);
    });
  }

  await mountFrontendMiddleware(app, projectRoot, isProd);

  app.listen(PORT, '0.0.0.0', () => {
    console.warn(`SafeAir Saathi server listening on port ${PORT}`);
  });
}

startServer().catch(async (err: unknown) => {
  try {
    const { extractSafeErrorDiagnostics } = await import('./src/utils/errorDiagnostics.js');
    console.error('Server failed to start:', extractSafeErrorDiagnostics(err));
  } catch {
    console.error('Server failed to start:', err instanceof Error ? err.message : 'Unknown error');
  }
  process.exit(1);
});
