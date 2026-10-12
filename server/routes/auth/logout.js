/** POST /api/auth/logout */
import { route } from '../../../api/_http.js';
import { endSession } from '../../../api/_auth.js';

export default route('POST, OPTIONS', async ({ res }) => {
  endSession(res);
  return { ok: true };
});
