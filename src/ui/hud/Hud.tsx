import { useStore } from '../../state/store.ts';
import { ContactChip } from '../card/ContactChip.tsx';
import { COMPACT, useMediaQuery } from '../lib.ts';
import { useUi } from '../uiStore.ts';
import { Minimap, useMapOpen } from './Minimap.tsx';
import { ControlsHint, Prompt, RidgeStrip, Toasts, ZoneToasts } from './Status.tsx';
import { Toolbar } from './Toolbar.tsx';

// Everything on screen while driving. Inert while a modal (panel or help) is open.
// Zone arrivals sit above the map (bottom left) on desktop, so the top of the screen, where the
// boards ahead of the car are, stays clear. On phones the map is a pill under the chip, and the
// arrivals join the top centre stack.
export function Hud() {
  const phase = useStore((s) => s.phase);
  const panel = useStore((s) => s.panel);
  const help = useUi((s) => s.help);
  const map = useMapOpen();
  const compact = useMediaQuery(COMPACT);
  if (phase !== 'intro' && phase !== 'play') return null;
  return (
    <div className="hud" data-map={map ? 'open' : 'closed'} inert={panel !== null || help || undefined}>
      <ContactChip />
      <Toolbar />
      <div className="topcenter">
        {compact && <ZoneToasts />}
        <Toasts />
        <RidgeStrip />
      </div>
      <div className="corner">
        {!compact && <ZoneToasts />}
        <Minimap />
      </div>
      <div className="bottomcenter">
        <Prompt />
        <ControlsHint />
      </div>
    </div>
  );
}
