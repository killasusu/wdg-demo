// Public news feed.
//   GET /api/news            -> { posts: [...] }  published stories, newest first
//   GET /api/news?slug=abc   -> { post: {...} }   one published story
import { getSql, ensureSchema, publicPost } from './_lib/db.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    try {
        await ensureSchema();
        const sql = getSql();
        const slug = typeof req.query.slug === 'string' ? req.query.slug : '';

        if (slug) {
            const rows = await sql`
                select * from news_posts where slug = ${slug} and published limit 1
            `;
            if (!rows.length) return res.status(404).json({ error: 'Story not found.' });
            res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
            return res.status(200).json({ post: publicPost(rows[0]) });
        }

        const rows = await sql`
            select * from news_posts where published
            order by published_on desc, id desc limit 50
        `;
        // Vercel's edge caches the list for a minute, so the database isn't hit on every visit
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
        return res.status(200).json({ posts: rows.map(publicPost) });
    } catch (error) {
        console.error('[news] failed', error);
        return res.status(503).json({ error: 'News is temporarily unavailable.' });
    }
}
