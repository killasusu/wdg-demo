// Database connection shared by the API functions.
// Files in api/ whose names start with "_" are helpers, not public endpoints.
//
// Works with any Postgres database. On Vercel: Project > Storage > Create Database > Neon,
// connect it to this project, and Vercel adds DATABASE_URL automatically.
import postgres from 'postgres';

let sql = null;
let schemaReady = null;

export function getSql() {
    if (sql) return sql;
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    // One connection per function instance; prepare:false keeps it compatible with
    // connection poolers (Neon, Supabase).
    sql = postgres(url, { max: 1, prepare: false, idle_timeout: 20 });
    return sql;
}

// Creates the table the first time it is needed, so no separate setup step is required.
export function ensureSchema() {
    if (!schemaReady) {
        const db = getSql();
        schemaReady = db`
            create table if not exists news_posts (
                id           serial primary key,
                slug         text unique not null,
                title        text not null,
                category     text not null default '',
                summary      text not null default '',
                body         text not null,
                image_url    text,
                published    boolean not null default false,
                published_on date not null default current_date,
                created_at   timestamptz not null default now()
            )
        `.catch((error) => {
            schemaReady = null; // try again on the next request
            throw error;
        });
    }
    return schemaReady;
}

// Fields that are safe to show on the public website
export function publicPost(row) {
    return {
        slug: row.slug,
        title: row.title,
        category: row.category,
        summary: row.summary,
        body: row.body,
        imageUrl: row.image_url,
        publishedOn: row.published_on instanceof Date
            ? row.published_on.toISOString().slice(0, 10)
            : String(row.published_on).slice(0, 10),
    };
}
