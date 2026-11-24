import {
  handleReverseGeocodeRequest,
  type ServerApiRequest,
  type ServerApiResponse,
} from '../src/server/apiHandlers.js';

/** Vercel serverless function execution timeout configuration. */
export const config = {
  maxDuration: 15,
};

/**
 * Vercel Node.js serverless function handler for `GET /api/reverse-geocode`.
 *
 * @param req - Incoming Vercel HTTP request.
 * @param res - Outgoing Vercel JSON response.
 */
export default async function handler(
  req: ServerApiRequest,
  res: ServerApiResponse,
): Promise<void> {
  await handleReverseGeocodeRequest(req, res);
}
