// Vercel serverless function: POST /api/contact
// Receives the contact form and emails it to the WDG mailbox through Resend (https://resend.com).
//
// Environment variables (set in Vercel > Project > Settings > Environment Variables):
//   RESEND_API_KEY  required. Your Resend API key (starts with "re_").
//   CONTACT_TO      optional. Mailbox that receives messages. Default: director@womendevelopmentgroup.org
//   CONTACT_FROM    optional. Sender shown on the email. Default: WDG Website <onboarding@resend.dev>
//                   (onboarding@resend.dev only delivers to the email you signed up to Resend with;
//                    verify your own domain in Resend to send from e.g. website@womendevelopmentgroup.org)

const SUBJECTS = [
    'Partnership Inquiry',
    'Funding / Donation',
    'Volunteer / Join WDG',
    'Program Information',
    'Media Inquiry',
    'Other',
];

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function clean(value, maxLength) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'Method not allowed.' });
    }

    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};

    // Honeypot: real visitors never see or fill this field, spam bots often do.
    if (clean(body.website, 200)) {
        return res.status(200).json({ ok: true });
    }

    const name = clean(body.name, 120);
    const organization = clean(body.organization, 160);
    const email = clean(body.email, 200);
    const subject = clean(body.subject, 60);
    const message = clean(body.message, 5000);

    const emailOk = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email);
    if (!name || !emailOk || !SUBJECTS.includes(subject) || !message) {
        return res.status(400).json({ ok: false, error: 'Please fill in all required fields correctly.' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.error('RESEND_API_KEY is not set');
        return res.status(500).json({ ok: false, error: 'The form is not set up yet. Please email us directly.' });
    }

    const to = process.env.CONTACT_TO || 'director@womendevelopmentgroup.org';
    const from = process.env.CONTACT_FROM || 'WDG Website <onboarding@resend.dev>';

    const text =
        'New message from the WDG website contact form\n\n' +
        'Name: ' + name + '\n' +
        'Organization: ' + (organization || '-') + '\n' +
        'Email: ' + email + '\n' +
        'Subject: ' + subject + '\n\n' +
        message + '\n';

    const html =
        '<h2 style="font-family:sans-serif">New message from the WDG website</h2>' +
        '<table style="font-family:sans-serif;border-collapse:collapse">' +
        '<tr><td style="padding:4px 12px 4px 0"><b>Name</b></td><td>' + escapeHtml(name) + '</td></tr>' +
        '<tr><td style="padding:4px 12px 4px 0"><b>Organization</b></td><td>' + escapeHtml(organization || '-') + '</td></tr>' +
        '<tr><td style="padding:4px 12px 4px 0"><b>Email</b></td><td>' + escapeHtml(email) + '</td></tr>' +
        '<tr><td style="padding:4px 12px 4px 0"><b>Subject</b></td><td>' + escapeHtml(subject) + '</td></tr>' +
        '</table>' +
        '<p style="font-family:sans-serif;white-space:pre-wrap">' + escapeHtml(message) + '</p>';

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: from,
                to: [to],
                reply_to: email,
                subject: '[Website] ' + subject + ' - ' + name,
                text: text,
                html: html,
            }),
        });

        if (!response.ok) {
            console.error('Resend error', response.status, await response.text());
            return res.status(502).json({ ok: false, error: 'Your message could not be sent. Please try again or email us directly.' });
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Resend request failed', error);
        return res.status(502).json({ ok: false, error: 'Your message could not be sent. Please try again or email us directly.' });
    }
};
