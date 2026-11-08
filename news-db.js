// Loads stories saved through the admin page (database) into the public site.
// - news.html:  adds them to the top of the story list
// - story.html: shows one story, chosen by ?slug=...
// All text is inserted with textContent, never as HTML, so a story can't inject code.

function formatMonth(isoDate) {
    const date = new Date(isoDate + 'T00:00:00Z');
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

function metaLine(post) {
    return formatMonth(post.publishedOn) + (post.category ? ' · ' + post.category : '');
}

// Story text: blank line = new paragraph, a line starting with "## " = heading
function renderBody(container, body) {
    body.split(/\n\s*\n/).forEach(function(block) {
        const trimmed = block.trim();
        if (!trimmed) return;
        if (trimmed.startsWith('## ')) {
            container.appendChild(el('h2', '', trimmed.slice(3)));
        } else {
            container.appendChild(el('p', 'story-paragraph', trimmed));
        }
    });
}

async function loadNewsList(list) {
    let data;
    try {
        const response = await fetch('/api/news');
        if (!response.ok) return; // no backend (e.g. GitHub Pages): keep the static stories
        data = await response.json();
    } catch (error) {
        return;
    }

    const first = list.firstElementChild;
    (data.posts || []).forEach(function(post) {
        const url = 'story.html?slug=' + encodeURIComponent(post.slug);
        const card = el('li', 'card');
        if (post.imageUrl) {
            card.classList.add('has-image');
            const img = el('img', 'card-image');
            img.src = post.imageUrl;
            img.alt = '';
            img.loading = 'lazy';
            card.appendChild(img);
        }
        card.appendChild(el('span', 'news-meta', metaLine(post)));
        const h3 = el('h3');
        const link = el('a', '', post.title);
        link.href = url;
        h3.appendChild(link);
        card.appendChild(h3);
        if (post.summary) card.appendChild(el('p', '', post.summary));
        const more = el('a', 'card-link', 'Read story →');
        more.href = url;
        card.appendChild(more);
        list.insertBefore(card, first);
    });
}

async function loadStory(page) {
    const slug = new URLSearchParams(location.search).get('slug') || '';
    const status = page.querySelector('.story-status');
    const article = page.querySelector('.story-body');

    try {
        const response = await fetch('/api/news?slug=' + encodeURIComponent(slug));
        if (!response.ok) throw new Error('not found');
        const post = (await response.json()).post;

        document.title = post.title + ' | Women Development Group (WDG)';
        page.querySelector('.story-eyebrow').textContent = metaLine(post);
        page.querySelector('.story-title').textContent = post.title;
        page.querySelector('.story-summary').textContent = post.summary || '';

        if (post.imageUrl) {
            const img = el('img', 'story-image');
            img.src = post.imageUrl;
            img.alt = '';
            article.appendChild(img);
        }
        renderBody(article, post.body);
        status.remove();
    } catch (error) {
        page.querySelector('.story-title').textContent = 'Story not found';
        status.textContent = 'This story may have been removed. Please return to the news page.';
    }
}

const newsList = document.getElementById('news-list');
if (newsList) loadNewsList(newsList);

const storyPage = document.querySelector('main.story-page');
if (storyPage) loadStory(storyPage);
