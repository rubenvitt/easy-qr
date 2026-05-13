import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ locals, url }) => {
  if (!locals.user) {
    const ret = encodeURIComponent(url.pathname + url.search);
    throw redirect(302, `/auth/login?return=${ret}`);
  }
  if (locals.user.role !== 'admin') {
    throw redirect(302, '/?noaccess=1');
  }
  return { user: locals.user };
};
