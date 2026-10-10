import { renderToStaticMarkup } from 'react-dom/server';
import { FONTS } from '../../config/palette.ts';
import { contact, panels, profile } from '../../data/profile.ts';
import { CardView } from '../card/CardView.tsx';
import { ClassicView } from '../classic/ClassicView.tsx';

// Build-time only. vite.config.ts loads this file through Vite's module runner while it writes
// index.html, so the recruiter card and the classic view are in the HTML before any JavaScript
// runs. It renders the same components React renders on load (CardView, ClassicView), so the
// takeover shows no change. Head tags are built from profile.ts here too.
//
// Never put the phone number in index.html: ClassicView leaves it out in 'static' mode, and the
// tags below don't use it.

export const SITE_URL = 'https://abhayraihal.github.io/portfolio/';
const OG_IMAGE = `${SITE_URL}og-image.png`; // 1200 x 630, made by the integrator
const BASE = import.meta.env.BASE_URL;

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// An app path under BASE ('/portfolio/images/x.jpg') as an absolute URL on the live site.
const absolute = (path: string) => SITE_URL + path.slice(BASE.length);

const font = (href: string) => `<link rel="preload" href="${attr(href)}" as="font" type="font/woff" crossorigin />`;
const meta = (name: string, content: string) => `<meta name="${name}" content="${attr(content)}" />`;
const prop = (property: string, content: string) => `<meta property="${property}" content="${attr(content)}" />`;

function StaticShell() {
  return (
    <div className="ui">
      <div className="layers">
        <div className="card-layer">
          <CardView phase="boot" progress={0} slow={false} />
        </div>
      </div>
      <ClassicView mode="static" />
    </div>
  );
}

function headTags(): string {
  const city = profile.location.split(',')[0];
  const title = `${profile.name} · ${profile.role} at ${profile.employer}`;
  const team = profile.teamLine.toLowerCase();
  const description = `${profile.name} is a ${profile.role} at ${profile.employer} in ${city}, working on ${team}. Drive a jeep around a small 3D valley to see his work, or read everything in the classic view.`;
  const social = `${profile.role} at ${profile.employer}, ${city}. Drive around a small 3D valley to see his work, projects and Codeforces rating.`;
  const person = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    jobTitle: profile.role,
    worksFor: { '@type': 'Organization', name: profile.employer },
    alumniOf: { '@type': 'CollegeOrUniversity', name: panels.education.title },
    url: SITE_URL,
    image: absolute(profile.photo.src),
    sameAs: [contact.linkedin, contact.github, contact.codeforces],
  };
  return [
    `<title>${text(title)}</title>`,
    meta('description', description),
    `<link rel="canonical" href="${SITE_URL}" />`,
    meta('theme-color', '#cfe2dc'),
    meta('color-scheme', 'light'),
    `<link rel="icon" href="${BASE}favicon.svg" type="image/svg+xml" />`,
    `<link rel="apple-touch-icon" href="${BASE}apple-touch-icon.png" />`,
    prop('og:type', 'website'),
    prop('og:site_name', profile.name),
    prop('og:title', title),
    prop('og:description', social),
    prop('og:url', SITE_URL),
    prop('og:image', OG_IMAGE),
    prop('og:image:width', '1200'),
    prop('og:image:height', '630'),
    meta('twitter:card', 'summary_large_image'),
    meta('twitter:title', title),
    meta('twitter:description', social),
    meta('twitter:image', OG_IMAGE),
    font(FONTS.body),
    font(FONTS.bodyBold),
    font(FONTS.display),
    // Without JavaScript there is nothing to start: swap the Start button for a pointer to the classic view.
    '<noscript><style>.start, .card__hint, .card__classic .key { display: none !important; } .card__nojs { display: block !important; }</style></noscript>',
    `<script type="application/ld+json">${JSON.stringify(person).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ');
}

export function renderStatic(): { head: string; body: string } {
  const html = renderToStaticMarkup(<StaticShell />);
  // React hoists resource hints (an image preload for the card photo) to the front of the
  // markup. They belong in <head>.
  let hints = '';
  const body = html.replace(/^(?:<link [^>]*>)+/, (m) => {
    hints = m;
    return '';
  });
  return { head: hints ? `${headTags()}\n    ${hints}` : headTags(), body };
}
