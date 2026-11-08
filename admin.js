// News admin page: log in, write stories (with a photo), publish/unpublish, delete.

const loginSection = document.querySelector('.admin-login');
const editorSections = document.querySelectorAll('.admin-editor');
const logoutButton = document.querySelector('.admin-logout');
const loginForm = document.getElementById('login-form');
const storyForm = document.getElementById('story-form');
const storyList = document.getElementById('story-list');
const imageInput = document.getElementById('s-image');
const preview = document.querySelector('.admin-preview');

let resizedImage = null; // data URL of the resized photo

function setStatus(form, message, isError) {
    const status = form.querySelector('.form-status');
    status.textContent = message;
    status.classList.toggle('error', Boolean(isError));
}

async function api(method, url, body) {
    const options = { method: method, headers: {} };
    if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    const data = await response.json().catch(function() { return {}; });
    if (response.status === 401 && url !== '/api/admin/login') showLogin();
    if (!response.ok) throw new Error(data.error || 'Request failed (' + response.status + ').');
    return data;
}

function showLogin(message) {
    loginSection.hidden = false;
    editorSections.forEach(function(section) { section.hidden = true; });
    logoutButton.hidden = true;
    if (message) setStatus(loginForm, message, true);
}

function showEditor() {
    loginSection.hidden = true;
    editorSections.forEach(function(section) { section.hidden = false; });
    logoutButton.hidden = false;
    document.getElementById('s-date').value = new Date().toISOString().slice(0, 10);
    loadStories();
}

// --- Login ---
async function checkLogin() {
    try {
        const state = await api('GET', '/api/admin/login');
        if (!state.configured) return showLogin('The admin password has not been set up yet (ADMIN_PASSWORD in Vercel).');
        state.loggedIn ? showEditor() : showLogin();
    } catch (error) {
        showLogin('Cannot reach the server. This page only works on the Vercel site.');
    }
}

loginForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const button = loginForm.querySelector('button');
    button.disabled = true;
    setStatus(loginForm, 'Checking...');
    try {
        await api('POST', '/api/admin/login', { password: loginForm.password.value });
        loginForm.reset();
        setStatus(loginForm, '');
        showEditor();
    } catch (error) {
        setStatus(loginForm, error.message, true);
    }
    button.disabled = false;
});

logoutButton.addEventListener('click', async function() {
    await api('DELETE', '/api/admin/login').catch(function() {});
    showLogin();
});

// --- Photo: shrink in the browser so uploads are small (important on slow connections) ---
function resizeImage(file, maxSize) {
    return new Promise(function(resolve, reject) {
        const img = new Image();
        img.onload = function() {
            const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(img.src);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = function() { reject(new Error('That file could not be read as an image.')); };
        img.src = URL.createObjectURL(file);
    });
}

imageInput.addEventListener('change', async function() {
    resizedImage = null;
    preview.hidden = true;
    const file = imageInput.files[0];
    if (!file) return;
    try {
        resizedImage = await resizeImage(file, 1600);
        preview.src = resizedImage;
        preview.hidden = false;
        setStatus(storyForm, '');
    } catch (error) {
        imageInput.value = '';
        setStatus(storyForm, error.message, true);
    }
});

// --- Save a story ---
storyForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const button = storyForm.querySelector('button[type="submit"]');
    const title = storyForm.title.value.trim();
    const body = storyForm.body.value.trim();
    if (title.length < 5 || body.length < 20) {
        setStatus(storyForm, 'Please add a title (5+ characters) and the story text (20+ characters).', true);
        return;
    }

    button.disabled = true;
    setStatus(storyForm, resizedImage ? 'Uploading photo and saving...' : 'Saving...');
    try {
        const result = await api('POST', '/api/admin/news', {
            title: title,
            category: storyForm.category.value,
            summary: storyForm.summary.value,
            body: body,
            publishedOn: storyForm.publishedOn.value,
            published: storyForm.published.checked,
            image: resizedImage || undefined,
        });
        storyForm.reset();
        resizedImage = null;
        preview.hidden = true;
        document.getElementById('s-date').value = new Date().toISOString().slice(0, 10);
        setStatus(storyForm, result.post.published
            ? 'Published! It will appear on the News page within about a minute.'
            : 'Saved as a draft.');
        loadStories();
    } catch (error) {
        setStatus(storyForm, error.message, true);
    }
    button.disabled = false;
});

// --- List, publish/unpublish, delete ---
function button(label, className, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + className;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
}

async function loadStories() {
    storyList.textContent = 'Loading...';
    try {
        const data = await api('GET', '/api/admin/news');
        storyList.textContent = '';
        if (!data.posts.length) {
            storyList.textContent = 'No stories yet. Write the first one above.';
            return;
        }
        data.posts.forEach(function(post) {
            const item = document.createElement('li');
            item.className = 'card admin-item';

            const meta = document.createElement('span');
            meta.className = 'news-meta';
            meta.textContent = post.publishedOn + (post.category ? ' · ' + post.category : '');
            const state = document.createElement('span');
            state.className = 'admin-badge' + (post.published ? ' is-live' : '');
            state.textContent = post.published ? 'Published' : 'Draft';

            const title = document.createElement('h3');
            title.textContent = post.title;

            const actions = document.createElement('div');
            actions.className = 'admin-actions';
            if (post.published) {
                const view = document.createElement('a');
                view.className = 'btn btn-outline';
                view.href = 'story.html?slug=' + encodeURIComponent(post.slug);
                view.target = '_blank';
                view.textContent = 'View';
                actions.appendChild(view);
            }
            actions.appendChild(button(post.published ? 'Unpublish' : 'Publish', 'btn-outline', async function() {
                await api('PATCH', '/api/admin/news', { id: post.id, published: !post.published }).catch(alertError);
                loadStories();
            }));
            actions.appendChild(button('Delete', 'btn-danger', async function() {
                if (!confirm('Delete "' + post.title + '" and its photo? This cannot be undone.')) return;
                await api('DELETE', '/api/admin/news?id=' + post.id).catch(alertError);
                loadStories();
            }));

            item.append(meta, state, title, actions);
            storyList.appendChild(item);
        });
    } catch (error) {
        storyList.textContent = error.message;
    }
}

function alertError(error) {
    alert(error.message);
}

checkLogin();
