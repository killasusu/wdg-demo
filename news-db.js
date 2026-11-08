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

// Photo inside a placeholder box: the box shows a soft shimmer while the photo
// downloads, then the photo fades in (no sudden pop).
function fadingImage(src, boxClass, imgClass) {
    const box = el('div', boxClass + ' is-loading');
    const img = el('img', imgClass);
    img.alt = '';
    img.decoding = 'async';
    function done() { box.classList.remove('is-loading'); }
    img.addEventListener('load', done);
    img.addEventListener('error', done);
    img.src = src;
    if (img.complete) done(); // already cached
    box.appendChild(img);
    return box;
}

// Show the whole list (old + new stories) together, with the site's usual staggered fade-up.
// Old stories keep fb.js's scroll animation; new stories (at the top) are marked visible.
function revealList(list) {
    Array.from(list.children).forEach(function(card, index) {
        card.style.setProperty('--i', index % 6);
        if (!card.classList.contains('reveal')) card.classList.add('reveal', 'in');
    });
    // Wait two frames so the browser has drawn the hidden state, then fade everything in
    requestAnimationFrame(function() {
        requestAnimationFrame(function() { list.classList.remove('news-pending'); });
    });
}

async function loadNewsList(list) {
    // Hold the list back briefly so new stories don't push the old ones down mid-animation.
    // If the server is slow, show the old stories after 2.5 s anyway.
    list.classList.add('news-pending');
    const giveUp = setTimeout(function() { revealList(list); }, 2500);

    let data = { posts: [] };
    try {
        const response = await fetch('/api/news');
        if (response.ok) data = await response.json(); // no backend (e.g. GitHub Pages): only static stories
    } catch (error) {
        // offline or no backend: keep the static stories
    }

    const first = list.firstElementChild;
    (data.posts || []).forEach(function(post) {
        const url = 'story.html?slug=' + encodeURIComponent(post.slug);
        const card = el('li', 'card');
        if (post.imageUrl) {
            card.classList.add('has-image');
            card.appendChild(fadingImage(post.imageUrl, 'card-media', 'card-image'));
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

    clearTimeout(giveUp);
    revealList(list);
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
            article.appendChild(fadingImage(post.imageUrl, 'story-media', 'story-image'));
        }
        renderBody(article, post.body);
        status.remove();
        article.classList.add('story-ready'); // text fades up
    } catch (error) {
        page.querySelector('.story-title').textContent = 'Story not found';
        status.textContent = 'This story may have been removed. Please return to the news page.';
    }
}

const newsList = document.getElementById('news-list');
if (newsList) loadNewsList(newsList);

const storyPage = document.querySelector('main.story-page');
if (storyPage) loadStory(storyPage);
