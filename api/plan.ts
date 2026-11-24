import {
  handlePlanRequest,
  type ServerApiRequest,
  type ServerApiResponse,
} from '../src/server/apiHandlers.js';

/** Vercel serverless function execution timeout configuration. */
export const config = {
  maxDuration: 60,
};

/**
 * Vercel Node.js serverless function handler for `POST /api/plan`.
 *
 * @param req - Incoming Vercel HTTP request.
 * @param res - Outgoing Vercel SSE/JSON response.
 */
export default async function handler(
  req: ServerApiRequest,
  res: ServerApiResponse,
): Promise<void> {
  await handlePlanRequest(req, res);
}
