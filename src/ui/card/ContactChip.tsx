import { contact, profile } from '../../data/profile.ts';
import { useStore } from '../../state/store.ts';
import { CodeIcon, MailIcon, ProfileIcon } from '../icons.tsx';
import { blurAfterPointer } from '../lib.ts';

// What the recruiter card shrinks into after Start: who this is and how to reach him. Clicked
// links let go of the focus, so the next Enter at a pad reads instead of opening the link again.
export function ContactChip() {
  return (
    <div className="chip">
      <button
        type="button"
        className="chip__about"
        aria-haspopup="dialog"
        onClick={(e) => {
          useStore.getState().openPanel('about');
          blurAfterPointer(e);
        }}
      >
        <img className="chip__photo" src={profile.avatar} alt="" width={44} height={44} />
        <span className="chip__text">
          <span className="chip__name">{profile.name}</span>
          <span className="chip__role">
            {profile.role} at {profile.employer}
          </span>
        </span>
      </button>
      <nav className="chip__links" aria-label="Contact">
        <a className="iconbtn has-tip" href={`mailto:${contact.email}`} aria-label={`Email ${contact.email}`} onClick={blurAfterPointer}>
          <MailIcon />
          <span className="tip" aria-hidden="true">
            Email
          </span>
        </a>
        <a className="iconbtn has-tip" href={contact.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn, opens in a new tab" onClick={blurAfterPointer}>
          <ProfileIcon />
          <span className="tip" aria-hidden="true">
            LinkedIn
          </span>
        </a>
        <a className="iconbtn has-tip" href={contact.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub, opens in a new tab" onClick={blurAfterPointer}>
          <CodeIcon />
          <span className="tip" aria-hidden="true">
            GitHub
          </span>
        </a>
      </nav>
    </div>
  );
}
