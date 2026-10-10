import { useStore } from '../../state/store.ts';
import { ContactChip } from '../card/ContactChip.tsx';
import { useUi } from '../uiStore.ts';
import { Minimap, useMapOpen } from './Minimap.tsx';
import { ControlsHint, Prompt, RidgeStrip, Toasts } from './Status.tsx';
import { Toolbar } from './Toolbar.tsx';

// Everything on screen while driving. Inert while a modal (panel or help) is open.
export function Hud() {
  const phase = useStore((s) => s.phase);
  const panel = useStore((s) => s.panel);
  const help = useUi((s) => s.help);
  const map = useMapOpen();
  if (phase !== 'intro' && phase !== 'play') return null;
  return (
    <div className="hud" data-map={map ? 'open' : 'closed'} inert={panel !== null || help || undefined}>
      <ContactChip />
      <Toolbar />
      <div className="topcenter">
        <Toasts />
        <RidgeStrip />
      </div>
      <Minimap />
      <div className="bottomcenter">
        <Prompt />
        <ControlsHint />
      </div>
    </div>
  );
}
