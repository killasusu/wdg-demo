// Admin login / logout / status.
//   GET    /api/admin/login  -> { loggedIn: true|false, configured: true|false }
//   POST   /api/admin/login  { password }  -> sets the login cookie
//   DELETE /api/admin/login  -> logs out
import { checkPassword, isLoggedIn, loginCookie, logoutCookie, passwordConfigured, isJsonRequest } from '../_lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'GET') {
        return res.status(200).json({ loggedIn: isLoggedIn(req), configured: passwordConfigured() });
    }

    if (req.method === 'DELETE') {
        res.setHeader('Set-Cookie', logoutCookie());
        return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST') {
        if (!isJsonRequest(req)) return res.status(415).json({ error: 'Expected JSON.' });
        if (!passwordConfigured()) {
            return res.status(503).json({ error: 'Admin password is not set up (ADMIN_PASSWORD, at least 10 characters).' });
        }
        const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';
        if (!checkPassword(password)) {
            // A short pause makes guessing passwords slower
            await new Promise((resolve) => setTimeout(resolve, 800));
            return res.status(401).json({ error: 'Wrong password.' });
        }
        res.setHeader('Set-Cookie', loginCookie());
        return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed.' });
}
