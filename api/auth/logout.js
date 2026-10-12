/** POST /api/auth/logout */
import { route } from '../_http.js';
import { endSession } from '../_auth.js';

export default route('POST, OPTIONS', async ({ res }) => {
  endSession(res);
  return { ok: true };
});
