import { panels } from '../../data/profile.ts';
import type { Panel, PanelId } from '../../data/profile.ts';
import { ArrowIcon, ExternalIcon, LinkIcon } from '../icons.tsx';
import { linkProps } from '../lib.ts';

// Renders one Panel from profile.ts. Order: chips, image, numbers, text, lists, links, next.
export function PanelContent({ panel, onOpen }: { panel: Panel; onOpen: (id: PanelId) => void }) {
  return (
    <>
      {panel.meta?.length ? (
        <ul className="chips pc-meta">
          {panel.meta.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}

      {panel.image && (
        <figure className="pc-image">
          <img src={panel.image.src} alt={panel.image.alt} decoding="async" />
        </figure>
      )}

      {panel.stats?.length ? (
        <dl className="pc-stats">
          {panel.stats.map((s) => (
            <div className="pc-stat" key={s.label}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {panel.body?.map((p) => (
        <p className="pc-text" key={p}>
          {p}
        </p>
      ))}

      {panel.bullets?.length ? (
        <ul className="pc-bullets">
          {panel.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}

      {panel.groups?.map((g) => (
        <section className="pc-group" key={g.label}>
          <h3>{g.label}</h3>
          <ul className="chips">
            {g.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}

      {panel.links?.length ? (
        <ul className="pc-links">
          {panel.links.map((l) => {
            const props = linkProps(l);
            return (
              <li key={l.url}>
                <a className="btn btn--link" {...props} aria-label={props.target ? `${l.label}, opens in a new tab` : undefined}>
                  <LinkIcon kind={l.kind} />
                  <span>{l.label}</span>
                  {props.target && <ExternalIcon />}
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}

      {panel.related?.length ? (
        <nav className="pc-next" aria-labelledby="pc-next-title">
          <h3 id="pc-next-title">Next</h3>
          <ul>
            {panel.related.map((id) => (
              <li key={id}>
                <button type="button" className="pc-next__btn" onClick={() => onOpen(id)}>
                  <span className="pc-next__text">
                    {panels[id].kicker && <span className="pc-next__kicker">{panels[id].kicker}</span>}
                    <span className="pc-next__title">{panels[id].title}</span>
                  </span>
                  <ArrowIcon />
                </button>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </>
  );
}
