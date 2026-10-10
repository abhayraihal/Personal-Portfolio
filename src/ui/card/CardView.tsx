import type { CSSProperties, MouseEvent, Ref } from 'react';
import { COLORS } from '../../config/palette.ts';
import { contact, jobs, panels, profile, projects } from '../../data/profile.ts';
import type { Phase } from '../../state/store.ts';
import { ClassicIcon, CodeIcon, MailIcon, ProfileIcon } from '../icons.tsx';
import { linkProps } from '../lib.ts';

// The recruiter card. Pure props in, markup out: the build pre-renders it into index.html
// (static/prerender.tsx) so it reads without JavaScript, and React renders the same markup on load.

export type CardViewProps = {
  phase: Phase;
  progress: number; // 0..100
  slow: boolean; // the scene is taking a long time
  onStart?: () => void;
  onClassic?: (e: MouseEvent<HTMLAnchorElement>) => void;
  cardRef?: Ref<HTMLElement>;
  photoRef?: Ref<HTMLImageElement>;
};

const TOP_PROJECTS = 3;
const FLAG_COUNT = 13;

// Prayer flags on a string across the top of the card, in their traditional order.
function Flags() {
  const w = 600;
  const x0 = 18; // string ends, inside the card's rounded corners
  const x1 = w - 18;
  const sag = 10;
  const flags = Array.from({ length: FLAG_COUNT }, (_, i) => {
    const t = (i + 0.5) / FLAG_COUNT;
    const x = x0 + t * (x1 - x0);
    const y = 3 + 4 * sag * t * (1 - t);
    const slope = (4 * sag * (1 - 2 * t)) / (x1 - x0);
    const angle = (Math.atan(slope) * 180) / Math.PI;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, angle: Math.round(angle * 100) / 100, color: COLORS.flags[i % COLORS.flags.length] };
  });
  return (
    <svg className="card__flags" viewBox={`0 0 ${w} 30`} preserveAspectRatio="xMidYMin meet" aria-hidden="true" focusable="false">
      <path d={`M${x0} 3 Q${w / 2} ${3 + 2 * sag} ${x1} 3`} />
      {flags.map((f) => (
        <rect key={f.x} x={(f.x - 11).toFixed(1)} y={f.y} width="22" height="15" rx="2" fill={f.color} transform={`rotate(${f.angle} ${f.x} ${f.y})`} />
      ))}
    </svg>
  );
}

function startLabel(phase: Phase, progress: number): string {
  if (phase !== 'boot') return 'Start driving';
  const pct = Math.round(progress);
  return pct > 0 ? `Loading ${pct}%` : 'Loading the valley';
}

export function CardView({ phase, progress, slow, onStart, onClassic, cardRef, photoRef }: CardViewProps) {
  const ready = phase !== 'boot';
  const education = panels.education;
  const top = projects.slice(0, TOP_PROJECTS);
  const fill = { '--progress': `${ready ? 100 : Math.max(0, Math.min(100, progress))}%` } as CSSProperties;
  return (
    <section className="card" aria-labelledby="card-name" ref={cardRef}>
      <div className="card__scroll">
        <Flags />
        <header className="card__head">
          <img className="card__photo" src={profile.avatar} alt="" width={88} height={88} ref={photoRef} />
          <div className="card__id">
            <h1 className="card__name" id="card-name">
              {profile.name}
            </h1>
            <p className="card__role">{profile.roleLine}</p>
            <p className="card__team">{profile.teamLine}</p>
          </div>
        </header>

        <ul className="card__highlights">
          {profile.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>

        <section className="card__section" aria-labelledby="card-work">
          <h2 id="card-work">Work</h2>
          <ol className="card__rows">
            {jobs.map((j) => (
              <li key={j.company} className="card__row" style={{ '--c': j.color } as CSSProperties}>
                <span className="card__row-title">{j.company}</span>
                <span className="card__row-when">{j.dates}</span>
                <span className="card__row-what">{j.role}</span>
                <span className="card__row-where">{j.place}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="card__section" aria-labelledby="card-edu">
          <h2 id="card-edu">Education</h2>
          <ul className="card__rows">
            <li className="card__row" style={{ '--c': COLORS.iit } as CSSProperties}>
              <span className="card__row-title">{education.title}</span>
              <span className="card__row-when">{education.meta?.[0]}</span>
              <span className="card__row-what">{education.kicker}</span>
              <span className="card__row-where">{education.meta?.[1]}</span>
            </li>
          </ul>
        </section>

        <section className="card__section" aria-labelledby="card-projects">
          <h2 id="card-projects">Projects</h2>
          <ul className="card__projects">
            {top.map((p) => (
              <li key={p.panel}>
                <a className="card__project-title" {...linkProps(p.links[0])}>
                  {p.title}
                </a>
                <span className="card__project-year">{p.year}</span>
                <span className="card__project-line">{p.tagline}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="card__foot">
        <nav className="card__links" aria-label="Contact">
          <a className="btn btn--small" href={`mailto:${contact.email}`}>
            <MailIcon />
            <span className="card__email-full">{contact.email}</span>
            <span className="card__email-short">Email</span>
          </a>
          <a className="btn btn--small" href={contact.linkedin} target="_blank" rel="noopener noreferrer">
            <ProfileIcon />
            <span>LinkedIn</span>
          </a>
          <a className="btn btn--small" href={contact.github} target="_blank" rel="noopener noreferrer">
            <CodeIcon />
            <span>GitHub</span>
          </a>
        </nav>
        <div className="card__actions">
          <button type="button" className="start" data-ready={ready} disabled={!ready} onClick={onStart} style={fill}>
            <span className="start__fill" aria-hidden="true" />
            <span className="start__label">{startLabel(phase, progress)}</span>
            {ready && <kbd className="key start__key">Enter</kbd>}
          </button>
          <a className="btn card__classic" href="#classic" onClick={onClassic}>
            <ClassicIcon />
            <span>Classic view</span>
            <kbd className="key">C</kbd>
          </a>
        </div>
        <p className="card__hint">
          <span className="for-fine">Drive with W A S D or the arrow keys. Stop on a ring and press Enter to read about it.</span>
          <span className="for-coarse">Drag on the left side of the screen to drive. Stop on a ring and tap the button to read about it.</span>
        </p>
        {slow && (
          <p className="card__slow">
            Slow connection? The classic view has everything.{' '}
            <a href="#classic" onClick={onClassic}>
              Open the classic view
            </a>
          </p>
        )}
        <p className="card__nojs">
          The 3D valley needs JavaScript. Everything on this card, and more, is in the <a href="#classic">classic view</a>.
        </p>
      </footer>
    </section>
  );
}
