# Abhay Singh Raihal: drive-around portfolio

A 3D portfolio you explore by driving a jeep around a small Himalayan valley, modelled loosely on the IIT Mandi campus where I studied. Each part of the valley is one part of my work: a career road that ends at Amazon, a projects garage, a ridge road built from my Codeforces rating history, the IIT Mandi campus and a football pitch.

Live site: https://abhayraihal.github.io/Personal-Portfolio/

If you'd rather read than drive, the page opens with a plain HTML summary, and the classic view (press `C`, or open `#classic`) has everything as a printable page.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Drive | `W A S D` or arrow keys | Left thumb joystick |
| Brake / boost | `Space` / `Shift` | Buttons on the right |
| Read about the thing you're parked on | `Enter` or `E` | Tap the prompt |
| Jump to a zone | `1` to `7`, or click the minimap | Tap the minimap |
| Reset the car / horn | `R` / `H` | Horn button, left of Brake |
| Classic view, sound, night | `C`, `M`, `N` | Toolbar |

## How it's built

- [React Three Fiber](https://github.com/pmndrs/react-three-fiber) and [drei](https://github.com/pmndrs/drei) on three.js, with [Rapier](https://rapier.rs) physics through `@react-three/rapier`. The car is a Rapier ray-cast vehicle.
- [zustand](https://github.com/pmndrs/zustand) for state, Vite and TypeScript for the build, and synthesized Web Audio for sound (no audio files).
- The Codeforces data is baked in at build time (`src/data/codeforces.ts`), so the site calls no APIs.
- Every fact on the site lives in `src/data/profile.ts` and `src/data/codeforces.ts`.
- Deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.

Run it locally:

```sh
npm ci
npm run dev       # http://127.0.0.1:4311/Personal-Portfolio/
npm run build     # type-check, then build to dist/
```

## Credits

- 3D models: [Kenney](https://kenney.nl) (CC0). License files are in `public/licenses/`.
- Fonts: Lilita One and Rubik, under the SIL Open Font License.
