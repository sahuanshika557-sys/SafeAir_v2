import {
  handleGeocodeRequest,
  type ServerApiRequest,
  type ServerApiResponse,
} from '../src/server/apiHandlers.js';

/**
 * Vercel Node.js serverless function handler for `GET /api/geocode`.
 *
 * @param req - Incoming Vercel HTTP request.
 * @param res - Outgoing Vercel JSON response.
 */
export default async function handler(
  req: ServerApiRequest,
  res: ServerApiResponse,
): Promise<void> {
  await handleGeocodeRequest(req, res);
}
