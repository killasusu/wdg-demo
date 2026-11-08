// Simple admin login: one shared password (ADMIN_PASSWORD), and a signed cookie that
// lasts 8 hours. Good enough for a small site with one or two editors.
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const COOKIE = 'wdg_admin';
const MAX_AGE = 8 * 60 * 60; // seconds

function secret() {
    // A separate secret is better; falling back to the password means changing the
    // password also logs everyone out.
    return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
}

function sign(value) {
    return createHmac('sha256', secret()).update(value).digest('base64url');
}

function sameText(a, b) {
    // Compare hashes so the comparison takes the same time whatever the input
    const ha = createHash('sha256').update(String(a)).digest();
    const hb = createHash('sha256').update(String(b)).digest();
    return timingSafeEqual(ha, hb);
}

export function passwordConfigured() {
    return (process.env.ADMIN_PASSWORD || '').length >= 10;
}

export function checkPassword(password) {
    return passwordConfigured() && sameText(password, process.env.ADMIN_PASSWORD);
}

function cookieAttributes(maxAge) {
    const secure = process.env.VERCEL ? '; Secure' : '';
    return `; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export function loginCookie() {
    const expires = String(Math.floor(Date.now() / 1000) + MAX_AGE);
    return `${COOKIE}=${expires}.${sign(expires)}${cookieAttributes(MAX_AGE)}`;
}

export function logoutCookie() {
    return `${COOKIE}=${cookieAttributes(0)}`;
}

export function isLoggedIn(req) {
    if (!passwordConfigured()) return false;
    const header = req.headers.cookie || '';
    const match = header.split(/;\s*/).find((part) => part.startsWith(COOKIE + '='));
    if (!match) return false;
    const [expires, signature] = match.slice(COOKIE.length + 1).split('.');
    if (!expires || !signature) return false;
    if (Number(expires) < Date.now() / 1000) return false;
    return sameText(signature, sign(expires));
}

// Admin requests must be JSON. Browsers can't send cross-site JSON without permission,
// which (with SameSite=Strict) protects against forged requests from other websites.
export function isJsonRequest(req) {
    return (req.headers['content-type'] || '').startsWith('application/json');
}
