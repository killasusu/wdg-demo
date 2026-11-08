// Admin news management (login required).
//   GET    /api/admin/news                         -> { posts: [...] } all stories incl. drafts
//   POST   /api/admin/news  { title, category, summary, body, publishedOn, published, image? }
//                           image = "data:image/jpeg;base64,..." (resized in the browser)
//   PATCH  /api/admin/news  { id, published }      -> publish / unpublish
//   DELETE /api/admin/news?id=123                  -> delete story and its photo
//
// Photos go to Vercel Blob: Project > Storage > Create > Blob (choose Public access),
// connect it to this project, and Vercel adds BLOB_READ_WRITE_TOKEN automatically.
import { randomBytes } from 'node:crypto';
import { put, del } from '@vercel/blob';
import { getSql, ensureSchema, publicPost } from '../_lib/db.js';
import { isLoggedIn, isJsonRequest } from '../_lib/auth.js';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function text(value, max) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function makeSlug(title) {
    const base = title
        .toLowerCase()
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'story';
    return base + '-' + randomBytes(3).toString('hex');
}

function parseImage(dataUrl) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) return { error: 'Photo must be a JPEG, PNG or WebP image.' };
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > MAX_IMAGE_BYTES) return { error: 'Photo is too large (max 3 MB).' };
    return { buffer, contentType: match[1], extension: IMAGE_TYPES[match[1]] };
}

async function createPost(req, res, sql) {
    const body = req.body || {};
    const title = text(body.title, 160);
    const category = text(body.category, 40);
    const summary = text(body.summary, 300);
    const storyText = text(body.body, 20000);
    const published = body.published === true;
    const publishedOn = /^\d{4}-\d{2}-\d{2}$/.test(body.publishedOn || '')
        ? body.publishedOn
        : new Date().toISOString().slice(0, 10);

    if (title.length < 5 || storyText.length < 20) {
        return res.status(400).json({ error: 'A story needs a title (5+ characters) and text (20+ characters).' });
    }

    const slug = makeSlug(title);
    let imageUrl = null;

    if (typeof body.image === 'string' && body.image) {
        const image = parseImage(body.image);
        if (image.error) return res.status(400).json({ error: image.error });
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
            return res.status(503).json({ error: 'Photo storage is not connected yet (Vercel Blob). Save the story without a photo.' });
        }
        const blob = await put(`news/${slug}.${image.extension}`, image.buffer, {
            access: 'public',
            contentType: image.contentType,
            addRandomSuffix: true,
        });
        imageUrl = blob.url;
    }

    const rows = await sql`
        insert into news_posts (slug, title, category, summary, body, image_url, published, published_on)
        values (${slug}, ${title}, ${category}, ${summary}, ${storyText}, ${imageUrl}, ${published}, ${publishedOn})
        returning *
    `;
    return res.status(201).json({ post: adminPost(rows[0]) });
}

function adminPost(row) {
    return { id: row.id, published: row.published, createdAt: row.created_at, ...publicPost(row) };
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (!isLoggedIn(req)) return res.status(401).json({ error: 'Please log in.' });
    if (req.method !== 'GET' && req.method !== 'DELETE' && !isJsonRequest(req)) {
        return res.status(415).json({ error: 'Expected JSON.' });
    }

    try {
        await ensureSchema();
        const sql = getSql();

        if (req.method === 'GET') {
            const rows = await sql`select * from news_posts order by published_on desc, id desc`;
            return res.status(200).json({ posts: rows.map(adminPost) });
        }

        if (req.method === 'POST') {
            return await createPost(req, res, sql);
        }

        if (req.method === 'PATCH') {
            const id = Number(req.body && req.body.id);
            const published = req.body && req.body.published === true;
            const rows = await sql`
                update news_posts set published = ${published} where id = ${id} returning *
            `;
            if (!rows.length) return res.status(404).json({ error: 'Story not found.' });
            return res.status(200).json({ post: adminPost(rows[0]) });
        }

        if (req.method === 'DELETE') {
            const id = Number(req.query.id);
            const rows = await sql`delete from news_posts where id = ${id} returning image_url`;
            if (!rows.length) return res.status(404).json({ error: 'Story not found.' });
            if (rows[0].image_url && process.env.BLOB_READ_WRITE_TOKEN) {
                await del(rows[0].image_url).catch((error) => console.error('[admin/news] photo delete failed', error));
            }
            return res.status(200).json({ ok: true });
        }

        res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
        return res.status(405).json({ error: 'Method not allowed.' });
    } catch (error) {
        console.error('[admin/news] failed', error);
        const message = /DATABASE_URL/.test(error.message)
            ? 'The database is not connected yet (DATABASE_URL).'
            : 'Something went wrong. Check the Vercel logs.';
        return res.status(500).json({ error: message });
    }
}
