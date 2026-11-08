// Fade content in as it scrolls into view
document.documentElement.classList.add('js');

const revealItems = document.querySelectorAll(
    '.stats li, .section-title, .card, .partners li, .callout, .prose > *, .cta .container'
);

if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('in');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    revealItems.forEach(function(item) {
        // Items in the same list appear one after another
        const siblings = Array.from(item.parentElement.children);
        item.style.setProperty('--i', siblings.indexOf(item) % 6);
        item.classList.add('reveal');
        observer.observe(item);
    });
}

// Contact form: check the fields, then send the message to /api/contact (Vercel).
// If the API isn't available (e.g. the GitHub Pages copy), open the visitor's email app instead.
const contactForm = document.getElementById('contact-form');

if (contactForm) {
    const status = contactForm.querySelector('.form-status');
    const submitButton = contactForm.querySelector('button[type="submit"]');

    function openEmailApp(data) {
        const body =
            'Name: ' + data.name + '\n' +
            'Organization: ' + (data.organization || '-') + '\n' +
            'Email: ' + data.email + '\n\n' +
            data.message;

        window.location.href = 'mailto:director@womendevelopmentgroup.org' +
            '?subject=' + encodeURIComponent('[Website] ' + data.subject) +
            '&body=' + encodeURIComponent(body);

        status.textContent = 'Thank you! Your email app should now open with your message. Press Send there to deliver it.';
    }

    function checkField(input) {
        const ok = input.checkValidity() && input.value.trim() !== '' || !input.required;
        input.closest('.field').classList.toggle('invalid', !ok);
        return ok;
    }

    contactForm.querySelectorAll('[required]').forEach(function(input) {
        input.addEventListener('blur', function() { checkField(input); });
        input.addEventListener('input', function() {
            if (input.closest('.field').classList.contains('invalid')) checkField(input);
        });
    });

    contactForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const required = Array.from(contactForm.querySelectorAll('[required]'));
        const bad = required.filter(function(input) { return !checkField(input); });
        if (bad.length) {
            bad[0].focus();
            return;
        }

        const data = Object.fromEntries(new FormData(contactForm));
        submitButton.disabled = true;
        status.classList.remove('error');
        status.textContent = 'Sending your message...';

        let response;
        try {
            response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
        } catch (error) {
            response = null;
        }

        // No backend here (404/405 or offline): fall back to the email app
        if (!response || response.status === 404 || response.status === 405) {
            submitButton.disabled = false;
            openEmailApp(data);
            return;
        }

        const result = await response.json().catch(function() { return {}; });
        submitButton.disabled = false;

        if (response.ok && result.ok) {
            contactForm.reset();
            status.textContent = 'Thank you! Your message has been sent. We will get back to you soon.';
        } else {
            status.classList.add('error');
            status.textContent = result.error || 'Your message could not be sent. Please email director@womendevelopmentgroup.org directly.';
        }
    });
}

// Create the button once, when the page loads
const scrollButton = document.createElement('button');
scrollButton.innerText = 'Scroll to top';
scrollButton.className = 'scroll-top';
document.body.appendChild(scrollButton);

scrollButton.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Only show the button once the visitor has scrolled down a bit
window.addEventListener('scroll', function() {
    scrollButton.classList.toggle('visible', window.scrollY > 300);
});

// Open and close the menu on small screens
const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('nav');

function setMenu(isOpen) {
    nav.classList.toggle('open', isOpen);
    navToggle.setAttribute('aria-expanded', isOpen);
    navToggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
}

if (navToggle && nav) {
    navToggle.addEventListener('click', function() {
        setMenu(!nav.classList.contains('open'));
    });

    // Close with the Escape key or by tapping outside the menu
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && nav.classList.contains('open')) {
            setMenu(false);
            navToggle.focus();
        }
    });

    document.addEventListener('click', function(event) {
        if (nav.classList.contains('open') && !event.target.closest('header')) {
            setMenu(false);
        }
    });
}
