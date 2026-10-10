import { useStore } from '../../state/store.ts';
import { ContactChip } from '../card/ContactChip.tsx';
import { COARSE, WIDE, useMediaQuery } from '../lib.ts';
import { useUi } from '../uiStore.ts';
import { Minimap, useMapOpen } from './Minimap.tsx';
import { ControlsHint, Prompt, RidgeStrip, Toasts, ZoneToasts } from './Status.tsx';
import { Toolbar } from './Toolbar.tsx';

// Everything on screen while driving. Inert while a modal (panel or help) is open.
// On wide screens with a mouse, zone arrivals sit above the map (bottom left), so the top of the
// screen, where the boards ahead of the car are, stays clear. Elsewhere the map is a pill (under
// the chip on touch screens) and the arrivals join the top centre stack, clear of the prompt.
export function Hud() {
  const phase = useStore((s) => s.phase);
  const panel = useStore((s) => s.panel);
  const help = useUi((s) => s.help);
  const map = useMapOpen();
  const wide = useMediaQuery(WIDE);
  const coarse = useMediaQuery(COARSE);
  const corner = wide && !coarse;
  if (phase !== 'intro' && phase !== 'play') return null;
  return (
    <div className="hud" data-map={map ? 'open' : 'closed'} inert={panel !== null || help || undefined}>
      <ContactChip />
      <Toolbar />
      <div className="topcenter">
        {!corner && <ZoneToasts />}
        <Toasts />
        <RidgeStrip />
      </div>
      <div className="corner">
        {corner && <ZoneToasts />}
        <Minimap />
      </div>
      <div className="bottomcenter">
        <Prompt />
        <ControlsHint />
      </div>
    </div>
  );
}
