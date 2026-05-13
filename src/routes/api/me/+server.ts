import { json, type RequestHandler } from '@sveltejs/kit';

export const prerender = false;

export const GET: RequestHandler = ({ locals }) =>
  json({ user: locals.user }, { headers: { 'Cache-Control': 'private, no-store' } });
