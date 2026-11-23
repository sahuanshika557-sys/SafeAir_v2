import {
  handleHealthRequest,
  type ServerApiRequest,
  type ServerApiResponse,
} from '../src/server/apiHandlers.js';

export const config = {
  maxDuration: 15,
};

/**
 * Vercel Node.js serverless function handler for `GET /api/health`.
 *
 * @param req - Incoming Vercel HTTP request.
 * @param res - Outgoing Vercel JSON response.
 */
export default async function handler(
  req: ServerApiRequest,
  res: ServerApiResponse,
): Promise<void> {
  await handleHealthRequest(req, res);
}
