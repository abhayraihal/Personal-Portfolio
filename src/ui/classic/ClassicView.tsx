import { Fragment } from 'react';
import type { CSSProperties, MouseEvent, ReactNode, Ref } from 'react';
import { COLORS } from '../../config/palette.ts';
import { codeforces, otherPlatforms } from '../../data/codeforces.ts';
import { coursework, earlyProjects, jobs, panels, paper, profile, projects } from '../../data/profile.ts';
import type { Link } from '../../data/profile.ts';
import { CarIcon, ExternalIcon, LinkIcon, PrintIcon } from '../icons.tsx';
import { linkProps, shortUrl } from '../lib.ts';
import { RatingChart } from './RatingChart.tsx';

// The whole portfolio as one scrollable, printable page. Pure props in, markup out: the build
// pre-renders it into index.html too (mode 'static', shown by #classic:target without JavaScript,
// and without the phone number).
//   overlay    over the world, with a close button
//   standalone the whole site when WebGL is missing (no close button)
//   static     the zero-JavaScript copy in index.html
//   print      rendered only while printing from the world (Cmd/Ctrl+P)

export type ClassicMode = 'overlay' | 'standalone' | 'static' | 'print';

type Props = {
  mode: ClassicMode;
  enter?: boolean; // fade in (opened from the world, not loaded at #classic)
  onClose?: () => void;
  onPrint?: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
};

const SECTIONS = [
  ['about', 'About'],
  ['experience', 'Experience'],
  ['projects', 'Projects'],
  ['research', 'Research'],
  ['hackathons', 'Hackathons'],
  ['education', 'Education'],
  ['cp', 'Competitive programming'],
  ['skills', 'Skills'],
  ['activities', 'Activities'],
  ['contact', 'Contact'],
] as const;

type SectionId = (typeof SECTIONS)[number][0];
const TITLE = Object.fromEntries(SECTIONS) as Record<SectionId, string>;

// With JavaScript the URL stays at #classic (it is the route); without it the browser follows the
// link and #classic:has(:target) keeps the page open.
function jump(e: MouseEvent<HTMLAnchorElement>) {
  const target = document.getElementById(e.currentTarget.hash.slice(1));
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ block: 'start' });
  target.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
}

function Section({ id, children }: { id: SectionId; children: ReactNode }) {
  return (
    <section className="cv-section" id={`cv-${id}`} aria-labelledby={`cv-${id}-title`}>
      <h2 className="cv-section__title" id={`cv-${id}-title`} tabIndex={-1}>
        {TITLE[id]}
      </h2>
      {children}
    </section>
  );
}

function Chips({ items, small }: { items: string[]; small?: boolean }) {
  if (!items.length) return null;
  return (
    <ul className={small ? 'chips chips--small' : 'chips'}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Bullets({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="cv-bullets">
      {items.map((b) => (
        <li key={b}>{b}</li>
      ))}
    </ul>
  );
}

const PRINT_URL_MAX = 48; // longer addresses are no use on paper (the PDF keeps the link)

// A link with its address printed after it on paper, where "GitHub" alone is no use.
function CvLink({ link, label, printUrl = true }: { link: Link; label?: string; printUrl?: boolean }) {
  const props = linkProps(link);
  const text = label ?? link.label;
  const url = shortUrl(link.url);
  const showUrl = printUrl && link.kind !== 'mail' && link.kind !== 'phone' && url !== text && url.length <= PRINT_URL_MAX;
  return (
    <a className="cv-link" {...props} aria-label={props.target ? `${text}, opens in a new tab` : undefined}>
      <LinkIcon kind={link.kind} />
      <span>{text}</span>
      {props.target && <ExternalIcon />}
      {showUrl && <span className="cv-url"> {url}</span>}
    </a>
  );
}

function LinkRow({ links }: { links?: Link[] }) {
  if (!links?.length) return null;
  return (
    <ul className="cv-links">
      {links.map((l) => (
        <li key={l.url}>
          <CvLink link={l} />
        </li>
      ))}
    </ul>
  );
}

function ItemHead({ title, when, sub }: { title: string; when?: string; sub?: ReactNode }) {
  return (
    <header className="cv-item__head">
      <h3 className="cv-item__title">{title}</h3>
      {when && <p className="cv-item__when">{when}</p>}
      {sub && <p className="cv-item__sub">{sub}</p>}
    </header>
  );
}

function Experience() {
  return (
    <Section id="experience">
      {jobs.map((job) => {
        const p = panels[job.panel];
        const stack = (p.meta ?? []).filter((m) => m !== job.dates);
        // Amazon's work is split into one panel per piece; the classic view lists each of them.
        const parts = job.panel === 'amazon' ? (p.related ?? []) : [];
        return (
          <article className="cv-item cv-item--bar" key={job.company} style={{ '--c': job.color } as CSSProperties}>
            <ItemHead title={job.company} when={job.dates} sub={`${job.role} · ${job.place}`} />
            <Chips items={stack} small />
            {parts.length ? (
              <div className="cv-parts">
                {parts.map((id) => {
                  const part = panels[id];
                  return (
                    <div className="cv-part" key={id}>
                      <h4 className="cv-part__title">{part.title}</h4>
                      <Bullets items={part.bullets} />
                      {part.meta && <Chips items={part.meta} small />}
                    </div>
                  );
                })}
              </div>
            ) : (
              <Bullets items={p.bullets} />
            )}
            <LinkRow links={p.links} />
          </article>
        );
      })}
    </Section>
  );
}

function Projects() {
  const early = panels['project-early'];
  return (
    <Section id="projects">
      {projects.map((pr) => {
        const p = panels[pr.panel];
        return (
          <article className="cv-item cv-project" key={pr.panel}>
            {pr.image && <img className="cv-project__img" src={pr.image} alt={p.image?.alt ?? ''} width={168} height={112} loading="lazy" decoding="async" />}
            <div className="cv-project__text">
              <ItemHead title={pr.title} when={String(pr.year)} sub={pr.tagline} />
              {p.body?.map((t) => (
                <p className="cv-text" key={t}>
                  {t}
                </p>
              ))}
              <Bullets items={p.bullets} />
              <Chips items={p.meta ?? pr.stack} small />
              <LinkRow links={pr.links} />
            </div>
          </article>
        );
      })}
      <article className="cv-item">
        <ItemHead title={early.title} when={early.kicker} />
        <ul className="cv-bullets">
          {earlyProjects.map((e) => (
            <li key={e.title}>
              <CvLink link={e.link} label={e.title} />: {e.line}
            </li>
          ))}
        </ul>
      </article>
    </Section>
  );
}

function Research() {
  const p = panels.paper;
  return (
    <Section id="research">
      <article className="cv-item">
        <ItemHead title={paper.title} sub={paper.venue} />
        {p.body?.map((t) => (
          <p className="cv-text" key={t}>
            {t}
          </p>
        ))}
        <p className="cv-text cv-authors">
          {paper.authors.map((a, i) => (
            <Fragment key={a}>
              {i > 0 && ', '}
              {a === profile.name ? <strong>{a}</strong> : a}
            </Fragment>
          ))}
        </p>
        <LinkRow links={p.links} />
      </article>
    </Section>
  );
}

function Education() {
  const edu = panels.education;
  const school = panels.school;
  return (
    <Section id="education">
      <article className="cv-item cv-item--bar" style={{ '--c': COLORS.iit } as CSSProperties}>
        <ItemHead title={edu.title} when={edu.meta?.[0]} sub={[edu.kicker, ...(edu.meta?.slice(1) ?? [])].join(' · ')} />
        <h4 className="cv-part__title">Coursework</h4>
        <Chips items={coursework} small />
      </article>
      <article className="cv-item">
        <ItemHead title={school.title} sub={school.kicker} />
        <ul className="cv-bullets">
          {school.stats?.map((s) => (
            <li key={s.label}>
              {s.label}: <strong>{s.value}</strong>
            </li>
          ))}
        </ul>
      </article>
    </Section>
  );
}

function Programming({ interactive }: { interactive: boolean }) {
  const cf = panels.codeforces;
  const other = panels['cp-platforms'];
  return (
    <Section id="cp">
      <dl className="cv-stats">
        {cf.stats?.map((s) => (
          <div className="cv-stat" key={s.label}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
      <RatingChart interactive={interactive} table={interactive} />
      <Bullets items={cf.bullets} />
      <h3 className="cv-minor">{other.title}</h3>
      <ul className="cv-bullets">
        {otherPlatforms.map((o) => (
          <li key={o.platform}>
            <CvLink link={{ label: o.platform, url: o.url, kind: 'profile' }} printUrl={false} /> ({o.handle}): {o.stat}.
          </li>
        ))}
        {other.bullets?.filter((b) => !otherPlatforms.some((o) => b.startsWith(o.platform))).map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <LinkRow links={[{ label: `Codeforces (${codeforces.handle})`, url: codeforces.url, kind: 'profile' }]} />
    </Section>
  );
}

export function ClassicView({ mode, enter, onClose, onPrint, headingRef }: Props) {
  const isStatic = mode === 'static';
  const interactive = mode === 'overlay' || mode === 'standalone';
  // The phone number is never in index.html, so the static copy leaves it out.
  const contactLinks = (panels.contact.links ?? []).filter((l) => !isStatic || l.kind !== 'phone');
  const headLinks = contactLinks.filter((l) => l.kind === 'mail' || l.kind === 'phone' || l.kind === 'linkedin' || l.kind === 'github');
  const skills = (panels.skills.groups ?? []).filter((g) => g.label !== 'Coursework');
  const credits = panels.credits;
  return (
    <main className={`classic classic--${mode}${enter ? ' classic--enter' : ''}`} id={mode === 'print' ? undefined : 'classic'} aria-labelledby="cv-name" tabIndex={-1}>
      {mode !== 'print' && (
        <div className="classic__bar">
          <p className="classic__label">
            <span className="classic__label-name">{profile.name}</span>
            <span className="classic__label-view">Classic view</span>
          </p>
          <div className="classic__actions">
            {!isStatic && (
              <button type="button" className="btn classic__print" onClick={onPrint}>
                <PrintIcon />
                <span className="classic__print-text">Print / Save as PDF</span>
              </button>
            )}
            {mode === 'overlay' && (
              <button type="button" className="btn btn--primary" onClick={onClose} aria-keyshortcuts="Escape">
                <CarIcon />
                <span>Back to the valley</span>
                <kbd className="key key--on-dark">Esc</kbd>
              </button>
            )}
            {isStatic && (
              <a className="btn" href="#">
                Back to the card
              </a>
            )}
          </div>
        </div>
      )}

      <div className="classic__layout">
        <nav className="cv-toc" aria-label="Sections">
          <ul>
            {SECTIONS.map(([id, title]) => (
              <li key={id}>
                <a href={`#cv-${id}`} onClick={jump}>
                  {title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="cv">
          {mode === 'standalone' && <p className="cv-note">This browser can't show the 3D valley (it needs WebGL 2), so here is everything on one page.</p>}

          <header className="cv-head">
            <img className="cv-head__photo" src={profile.photo.src} alt={profile.photo.alt} width={136} height={136} loading="lazy" decoding="async" />
            <div className="cv-head__text">
              <h1 className="cv-head__name" id="cv-name" tabIndex={-1} ref={headingRef}>
                {profile.name}
              </h1>
              <p className="cv-head__role">{profile.roleLine}</p>
              <p className="cv-head__team">{profile.teamLine}</p>
              <ul className="cv-links cv-head__links">
                {headLinks.map((l) => (
                  <li key={l.url}>
                    <CvLink link={l} />
                  </li>
                ))}
              </ul>
            </div>
          </header>
          <Chips items={profile.highlights} />

          <Section id="about">
            {panels.about.body?.map((t) => (
              <p className="cv-text" key={t}>
                {t}
              </p>
            ))}
          </Section>

          <Experience />
          <Projects />
          <Research />

          <Section id="hackathons">
            <Bullets items={panels.hackathons.bullets} />
          </Section>

          <Education />
          <Programming interactive={interactive} />

          <Section id="skills">
            <div className="cv-skills">
              {skills.map((g) => (
                <div className="cv-skill" key={g.label}>
                  <h3 className="cv-skill__title">{g.label}</h3>
                  <Chips items={g.items} small />
                </div>
              ))}
            </div>
          </Section>

          <Section id="activities">
            <Bullets items={panels.activities.bullets} />
            {panels.sports.body?.map((t) => (
              <p className="cv-text" key={t}>
                {t}
              </p>
            ))}
          </Section>

          <Section id="contact">
            <ul className="cv-contact">
              {contactLinks.map((l) => (
                <li key={l.url}>
                  <CvLink link={l} />
                </li>
              ))}
            </ul>
          </Section>

          <footer className="cv-foot">
            {credits.body?.map((t) => (
              <p key={t}>{t}</p>
            ))}
            <LinkRow links={credits.links} />
          </footer>
        </article>
      </div>
    </main>
  );
}
