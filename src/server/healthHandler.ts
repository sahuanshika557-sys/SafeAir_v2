import {
  HEALTH_PROBE_TIMEOUT_MS,
  HTTP_INTERNAL_ERROR,
  HTTP_OK,
  HTTP_SERVICE_UNAVAILABLE,
  HTTP_TOO_MANY_REQUESTS,
} from '../constants/index.js';
import { classifyUpstreamError, extractSafeErrorDiagnostics } from '../utils/errorDiagnostics.js';
import { createLinkedTimeoutController } from '../utils/network.js';
import {
  buildHealthProbeModelConfig,
  createGeminiClient,
  getAiTestOverrides,
  getGeminiModelCandidates,
  getPrimaryGeminiModel,
  hasConfiguredGeminiKey,
} from './geminiRunner.js';
import { getQueryParam, sendJson, type ServerApiRequest, type ServerApiResponse } from './httpUtils.js';
import { consumeProbeRateLimit } from './rateLimitStore.js';
import { runApiRoute } from './routeHelpers.js';

const MIN_HTTP_STATUS = 100;
const MAX_HTTP_STATUS = 599;

type HealthProbeCategory =
  | 'missing_key'
  | 'invalid_key'
  | 'quota_exceeded'
  | 'model_unavailable'
  | 'timeout'
  | 'upstream_error';

function sendHealthProbeError(
  res: ServerApiResponse,
  modelTried: string,
  err: unknown,
): void {
  const { category, httpStatus } = classifyUpstreamError(err);
  const diag = extractSafeErrorDiagnostics(err);
  const probeCategory: HealthProbeCategory =
    category === 'bad_request' ? 'upstream_error' : category;
  const reportedStatus =
    typeof diag.status === 'number' &&
    diag.status >= MIN_HTTP_STATUS &&
    diag.status <= MAX_HTTP_STATUS
      ? diag.status
      : httpStatus;
  console.error('[SafeAir Saathi] /api/health probe failed:', {
    model: modelTried,
    category: probeCategory,
    status: reportedStatus,
  });
  sendJson(
    res,
    httpStatus,
    { ok: false, modelTried, status: reportedStatus, category: probeCategory },
    'no-store',
  );
}

async function runHealthProbe(req: ServerApiRequest, res: ServerApiResponse): Promise<void> {
  const modelTried = getPrimaryGeminiModel();
  if (!consumeProbeRateLimit(req).allowed) {
    sendJson(
      res,
      HTTP_TOO_MANY_REQUESTS,
      { ok: false, modelTried, status: HTTP_TOO_MANY_REQUESTS, category: 'quota_exceeded' satisfies HealthProbeCategory },
      'no-store',
    );
    return;
  }

  const ai = createGeminiClient();
  if (!ai) {
    sendJson(
      res,
      HTTP_SERVICE_UNAVAILABLE,
      { ok: false, modelTried, status: HTTP_SERVICE_UNAVAILABLE, category: 'missing_key' satisfies HealthProbeCategory },
      'no-store',
    );
    return;
  }

  const probeTimeout = getAiTestOverrides()?.totalTimeoutMs ?? HEALTH_PROBE_TIMEOUT_MS;
  const { controller, cleanup } = createLinkedTimeoutController(probeTimeout);
  try {
    await ai.models.generateContent({
      model: modelTried,
      contents: 'Reply with OK.',
      config: buildHealthProbeModelConfig(modelTried, controller.signal),
    });
    sendJson(res, HTTP_OK, { ok: true, modelTried, status: HTTP_OK, category: null }, 'no-store');
  } catch (err: unknown) {
    sendHealthProbeError(res, modelTried, err);
  } finally {
    cleanup();
  }
}

/**
 * Shared handler for `GET /api/health` exposing configuration readiness and optional
 * rate-limited `?probe=1` live Gemini connectivity diagnostics without leaking secrets.
 */
export async function handleHealthRequest(
  req: ServerApiRequest,
  res: ServerApiResponse,
): Promise<void> {
  await runApiRoute(
    req,
    res,
    {
      allowedMethod: 'GET',
      routeLabel: '/api/health',
      onError: () =>
        sendJson(res, HTTP_INTERNAL_ERROR, { ok: false, error: 'Health check error.' }, 'no-store'),
    },
    async () => {
      const probeParam = getQueryParam(req, 'probe').trim().toLowerCase();
      if (probeParam === '1' || probeParam === 'true') {
        await runHealthProbe(req, res);
        return;
      }

      sendJson(
        res,
        HTTP_OK,
        {
          ok: true,
          keyConfigured: hasConfiguredGeminiKey(),
          model: getPrimaryGeminiModel(),
          fallbackModels: getGeminiModelCandidates(),
          runtime: 'nodejs',
          time: new Date().toISOString(),
        },
        'no-store',
      );
    },
  );
}
