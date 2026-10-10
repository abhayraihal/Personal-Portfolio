// Kenney CC0 models copied from scripts/asset-manifest.json (generated). Each kit folder under
// public/models/ holds its GLBs plus Textures/colormap.png, which the GLBs reference relatively.
// scale = the manifest's suggestedScale (jeep at 1x); <Model> multiplies it by WORLD_SCALE.
// min/max are the native (unscaled) bounds in metres, +Y up, model front is +Z unless noted.

export type ModelInfo = {
  url: string;
  kit: string;
  scale: number;
  min: [number, number, number];
  max: [number, number, number];
  role: string;
  tris: number;
  doubleSided?: boolean;
};

export const MODELS = {
  'vehicle-jeep-suv': { url: 'models/car-kit/vehicle-jeep-suv.glb', kit: 'car-kit', scale: 1, min: [-0.75, 0, -1.35], max: [0.75, 1.3, 1.35], role: 'player-vehicle', tris: 2474 }, // Player vehicle. Boxy jeep/SUV with hardtop and rear spare tire. Forward is +Z. Four drivable wheels are root-level nodes; the spare 'wheel-b
  'vehicle-alt-pickup-truck': { url: 'models/car-kit/vehicle-alt-pickup-truck.glb', kit: 'car-kit', scale: 1, min: [-0.75, 0, -1.5], max: [0.75, 1.3, 1.45], role: 'player-vehicle-alternative', tris: 2082 }, // Alternative 1: pickup with open bed (closest to the Bruno Simon pickup). Same rig as the jeep: 'body' + 4 root-level wheel nodes, forward +Z
  'vehicle-alt-monster-truck': { url: 'models/toy-car-kit/vehicle-alt-monster-truck.glb', kit: 'toy-car-kit', scale: 3, min: [-0.313, 0, -0.438], max: [0.313, 0.75, 0.438], role: 'player-vehicle-alternative', tris: 1272 }, // Alternative 2: toy monster truck with oversized wheels. 'body' + 4 root-level wheel nodes (wheel-fl/fr/bl/br). Forward is -Z (front wheels a
  'tree-deodar-tall': { url: 'models/survival-kit/tree-deodar-tall.glb', kit: 'survival-kit', scale: 4, min: [-0.281, 0, -0.263], max: [0.272, 1.711, 0.263], role: 'conifer', tris: 254 }, // Tall slender tiered conifer; best deodar silhouette.
  'tree-deodar': { url: 'models/survival-kit/tree-deodar.glb', kit: 'survival-kit', scale: 4, min: [-0.281, 0, -0.263], max: [0.272, 1.411, 0.263], role: 'conifer', tris: 226 }, // Shorter version of the deodar.
  'tree-pine-full': { url: 'models/holiday-kit/tree-pine-full.glb', kit: 'holiday-kit', scale: 3, min: [-0.595, 0, -0.595], max: [0.595, 1.92, 0.595], role: 'conifer', tris: 234 }, // Full, wide tiered pine.
  'tree-pine-snow': { url: 'models/holiday-kit/tree-pine-snow.glb', kit: 'holiday-kit', scale: 3, min: [-0.595, 0, -0.595], max: [0.595, 1.92, 0.595], role: 'conifer', tris: 378 }, // Same pine with snow on each tier; use on upper slopes.
  'tree-pine-cone': { url: 'models/platformer-kit/tree-pine-cone.glb', kit: 'platformer-kit', scale: 3, min: [-0.474, 0, -0.474], max: [0.474, 1.997, 0.474], role: 'conifer', tris: 204 }, // Smooth rounded cone pine; adds a softer toy silhouette.
  'rock-grey-a': { url: 'models/survival-kit/rock-grey-a.glb', kit: 'survival-kit', scale: 2.5, min: [-0.3, 0, -0.297], max: [0.255, 0.393, 0.324], role: 'rock', tris: 104 }, // Grey-violet boulder.
  'rock-grey-b': { url: 'models/survival-kit/rock-grey-b.glb', kit: 'survival-kit', scale: 2.5, min: [-0.378, 0, -0.355], max: [0.456, 0.419, 0.37], role: 'rock', tris: 156 }, // Wide grey-violet boulder.
  'rock-grey-c': { url: 'models/survival-kit/rock-grey-c.glb', kit: 'survival-kit', scale: 2.5, min: [-0.381, 0, -0.289], max: [0.402, 0.51, 0.277], role: 'rock', tris: 120 }, // Taller grey-violet boulder.
  'rocks-snowcap-large': { url: 'models/holiday-kit/rocks-snowcap-large.glb', kit: 'holiday-kit', scale: 1.5, min: [-1.487, 0, -1.342], max: [1.654, 1.713, 1.345], role: 'rock', tris: 696 }, // Snow-capped boulder cluster for valley walls and mountain feel.
  'rocks-snowcap-small': { url: 'models/holiday-kit/rocks-snowcap-small.glb', kit: 'holiday-kit', scale: 1.5, min: [-0.77, 0, -0.683], max: [0.77, 0.646, 0.731], role: 'rock', tris: 330 }, // Smaller snow-capped cluster.
  'stones-river-flat': { url: 'models/platformer-kit/stones-river-flat.glb', kit: 'platformer-kit', scale: 2.5, min: [-0.358, 0, -0.39], max: [0.353, 0.05, 0.399], role: 'river-stones', tris: 120 }, // Flat stepping stones for river banks and paths.
  'grass-tuft': { url: 'models/platformer-kit/grass-tuft.glb', kit: 'platformer-kit', scale: 2, min: [-0.259, 0, -0.272], max: [0.259, 0.314, 0.272], role: 'grass', tris: 72 }, // Chunky two-blade grass tuft; good for instancing.
  'grass-clump': { url: 'models/survival-kit/grass-clump.glb', kit: 'survival-kit', scale: 3, min: [-0.238, 0, -0.244], max: [0.238, 0.142, 0.244], role: 'grass', tris: 144 }, // Spiky low grass clump.
  'flowers-blue-poppy': { url: 'models/platformer-kit/flowers-blue-poppy.glb', kit: 'platformer-kit', scale: 2.5, min: [-0.379, 0, -0.402], max: [0.398, 0.137, 0.384], role: 'flowers', tris: 264 }, // Low blue flowers with yellow centres; reads as Himalayan blue poppy.
  'flowers-tall': { url: 'models/platformer-kit/flowers-tall.glb', kit: 'platformer-kit', scale: 1.5, min: [-0.274, 0, -0.308], max: [0.272, 0.462, 0.31], role: 'flowers', tris: 398 }, // Taller flower cluster.
  'mushrooms': { url: 'models/platformer-kit/mushrooms.glb', kit: 'platformer-kit', scale: 1.5, min: [-0.262, 0, -0.256], max: [0.26, 0.289, 0.256], role: 'mushrooms', tris: 126 }, // Mushroom cluster.
  'plant-leafy': { url: 'models/platformer-kit/plant-leafy.glb', kit: 'platformer-kit', scale: 2.5, min: [-0.256, 0, -0.287], max: [0.256, 0.172, 0.155], role: 'bush', tris: 108 }, // Low leafy plant / shrub filler.
  'log': { url: 'models/survival-kit/log.glb', kit: 'survival-kit', scale: 2.5, min: [-0.122, -0.106, -0.5], max: [0.127, 0.171, 0.5], role: 'log', tris: 88 }, // Fallen log (long axis Z).
  'log-small': { url: 'models/survival-kit/log-small.glb', kit: 'survival-kit', scale: 2.5, min: [-0.125, 0, -0.325], max: [0.125, 0.277, 0.325], role: 'log', tris: 88 }, // Short log (long axis Z).
  'stump': { url: 'models/survival-kit/stump.glb', kit: 'survival-kit', scale: 3, min: [-0.1, 0, -0.1], max: [0.1, 0.261, 0.1], role: 'stump', tris: 52 }, // Tree stump.
  'snow-patch': { url: 'models/holiday-kit/snow-patch.glb', kit: 'holiday-kit', scale: 2, min: [-0.928, 0, -0.724], max: [0.928, 0.1, 0.724], role: 'snow', tris: 168 }, // Flat snow patch to lay on terrain at higher altitude.
  'crate-wood': { url: 'models/platformer-kit/crate-wood.glb', kit: 'platformer-kit', scale: 2, min: [-0.25, 0, -0.25], max: [0.25, 0.5, 0.25], role: 'crate', tris: 156 }, // Wooden crate; pushable physics box.
  'crate-wood-banded': { url: 'models/platformer-kit/crate-wood-banded.glb', kit: 'platformer-kit', scale: 2, min: [-0.3, 0, -0.3], max: [0.3, 0.6, 0.3], role: 'crate', tris: 428 }, // Heavier metal-banded crate.
  'barrel-wood': { url: 'models/platformer-kit/barrel-wood.glb', kit: 'platformer-kit', scale: 2, min: [-0.259, 0, -0.259], max: [0.259, 0.476, 0.259], role: 'barrel', tris: 148 }, // Wooden barrel.
  'barrel-drum': { url: 'models/survival-kit/barrel-drum.glb', kit: 'survival-kit', scale: 2.6, min: [-0.118, 0, -0.118], max: [0.118, 0.344, 0.118], role: 'barrel', tris: 412 }, // Red/blue metal drum.
  'traffic-cone': { url: 'models/car-kit/traffic-cone.glb', kit: 'car-kit', scale: 1, min: [-0.238, 0, -0.238], max: [0.238, 0.595, 0.238], role: 'cone', tris: 172 }, // Traffic cone at the jeep's scale.
  'barrier-concrete': { url: 'models/city-kit-roads/barrier-concrete.glb', kit: 'city-kit-roads', scale: 6, min: [-0.068, 0, -0.112], max: [0.068, 0.13, 0.112], role: 'barrier', tris: 60 }, // Concrete road barrier. City-kit-roads props are tiny native (0.13 m tall); scale x6.
  'fence-wood': { url: 'models/platformer-kit/fence-wood.glb', kit: 'platformer-kit', scale: 2.5, min: [-0.5, 0, 0.35], max: [0.5, 0.4, 0.49], role: 'fence', tris: 48, doubleSided: true }, // Wooden fence section, 1 m native.
  'fence-rope': { url: 'models/platformer-kit/fence-rope.glb', kit: 'platformer-kit', scale: 2.5, min: [-0.475, 0, -0.105], max: [0.475, 0.3, 0.105], role: 'fence', tris: 180, doubleSided: true }, // Rope fence with posts.
  'flag-pennant-red': { url: 'models/platformer-kit/flag-pennant-red.glb', kit: 'platformer-kit', scale: 2.5, min: [-0.056, 0, -0.056], max: [0.367, 0.9, 0.056], role: 'flag', tris: 110, doubleSided: true }, // Red flag on a post; zone marker.
  'banner-darchog-blue': { url: 'models/minigolf-kit/banner-darchog-blue.glb', kit: 'minigolf-kit', scale: 4, min: [-0.257, 0, -0.039], max: [0.039, 1.025, 0.039], role: 'flag', tris: 86, doubleSided: true }, // Vertical banner on a white pole; group several as darchog (vertical prayer flag) poles.
  'banner-darchog-red': { url: 'models/minigolf-kit/banner-darchog-red.glb', kit: 'minigolf-kit', scale: 4, min: [-0.257, 0, -0.039], max: [0.039, 1.025, 0.039], role: 'flag', tris: 86, doubleSided: true }, // Red version of the vertical banner.
  'banner-darchog-green': { url: 'models/minigolf-kit/banner-darchog-green.glb', kit: 'minigolf-kit', scale: 4, min: [-0.257, 0, -0.039], max: [0.039, 1.025, 0.039], role: 'flag', tris: 86, doubleSided: true }, // Green version of the vertical banner.
  'pole-prayer-flag-mast': { url: 'models/holiday-kit/pole-prayer-flag-mast.glb', kit: 'holiday-kit', scale: 3, min: [-0.25, 0, -0.25], max: [0.25, 1.4, 0.25], role: 'flag', tris: 62, doubleSided: true }, // Plain pole on a base; anchor for procedurally generated prayer-flag strings (no Kenney prayer-flag string exists).
  'signpost-arrows': { url: 'models/survival-kit/signpost-arrows.glb', kit: 'survival-kit', scale: 4, min: [-0.112, 0, -0.018], max: [0.102, 0.46, 0.025], role: 'signpost', tris: 44 }, // Post with two arrow boards; zone direction sign.
  'sign-board': { url: 'models/platformer-kit/sign-board.glb', kit: 'platformer-kit', scale: 2.5, min: [-0.245, 0, -0.056], max: [0.239, 0.6, 0.075], role: 'signpost', tris: 76 }, // Wooden board sign; put zone titles on it as a decal or text mesh.
  'ramp-wood': { url: 'models/platformer-kit/ramp-wood.glb', kit: 'platformer-kit', scale: 2.5, min: [-0.5, 0, -0.5], max: [0.5, 0.57, 0.527], role: 'ramp', tris: 84 }, // Wooden slat ramp.
  'ramp-kicker': { url: 'models/mini-skate/ramp-kicker.glb', kit: 'mini-skate', scale: 4, min: [-1, 0, 0], max: [0, 0.3, 0.5], role: 'ramp', tris: 94 }, // Curved kicker; best car jump.
  'ramp-funbox': { url: 'models/mini-skate/ramp-funbox.glb', kit: 'mini-skate', scale: 5, min: [-0.5, -0.05, -0.5], max: [0.5, 0.15, 0.5], role: 'ramp', tris: 28 }, // Low pyramid funbox.
  'lamp-post-lantern': { url: 'models/holiday-kit/lamp-post-lantern.glb', kit: 'holiday-kit', scale: 2, min: [-0.263, 0, -0.227], max: [0.263, 1.737, 0.227], role: 'lamp-post', tris: 172 }, // Vintage lantern lamp post; add a PointLight at the lamp head.
  'lamp-post-street': { url: 'models/city-kit-roads/lamp-post-street.glb', kit: 'city-kit-roads', scale: 6, min: [-0.025, 0, -0.2], max: [0.025, 0.675, 0.025], role: 'lamp-post', tris: 92 }, // Modern curved street light for the campus/office road.
  'bench-wood': { url: 'models/holiday-kit/bench-wood.glb', kit: 'holiday-kit', scale: 1.4, min: [-0.561, 0, -0.316], max: [0.561, 0.731, 0.316], role: 'bench', tris: 160 }, // Wooden bench.
  'goal-arch': { url: 'models/toy-car-kit/goal-arch.glb', kit: 'toy-car-kit', scale: 3, min: [-0.775, 0, -0.15], max: [0.775, 1.162, 0.15], role: 'goal', tris: 104 }, // Arch the car can drive through; stand-in for a goal. No Kenney goal post or net exists in these kits.
  'trophy-gold-cup': { url: 'models/mini-arena/trophy-gold-cup.glb', kit: 'mini-arena', scale: 3, min: [-0.285, 0, -0.226], max: [0.285, 0.477, 0.226], role: 'trophy', tris: 244 }, // Gold cup for the achievements zone.
  'pedestal-column': { url: 'models/mini-arena/pedestal-column.glb', kit: 'mini-arena', scale: 1.5, min: [-0.302, 0, -0.3], max: [0.302, 1, 0.3], role: 'trophy', tris: 168 }, // Stone column; trophy pedestal.
  'award-star': { url: 'models/platformer-kit/award-star.glb', kit: 'platformer-kit', scale: 3, min: [-0.182, 0, -0.119], max: [0.182, 0.363, 0.119], role: 'trophy', tris: 30 }, // Gold star; floating achievement badge.
  'coin-gold': { url: 'models/platformer-kit/coin-gold.glb', kit: 'platformer-kit', scale: 2.5, min: [-0.2, 0, -0.087], max: [0.2, 0.4, 0.087], role: 'collectible', tris: 124 }, // Gold coin collectible.
  'ball-red': { url: 'models/minigolf-kit/ball-red.glb', kit: 'minigolf-kit', scale: 15, min: [-0.035, -0.035, -0.035], max: [0.035, 0.035, 0.035], role: 'ball', tris: 572 }, // Golf ball (0.07 m native); scale x15 for a pushable 1 m ball.
  'brick-block': { url: 'models/platformer-kit/brick-block.glb', kit: 'platformer-kit', scale: 1.2, min: [-0.25, 0, -0.25], max: [0.25, 0.5, 0.25], role: 'brick', tris: 188 }, // Brick-pattern block; stack into a knock-down wall.
  'bricks-rubble': { url: 'models/mini-arena/bricks-rubble.glb', kit: 'mini-arena', scale: 2, min: [-0.386, 0, -0.423], max: [0.386, 0.412, 0.423], role: 'brick', tris: 120 }, // Loose brick pile; rubble next to the wall.
  'campfire': { url: 'models/survival-kit/campfire.glb', kit: 'survival-kit', scale: 4, min: [-0.139, 0, -0.135], max: [0.139, 0.109, 0.135], role: 'campfire', tris: 305 }, // Campfire ring; centre of the contact zone.
  'bridge-wood-rope': { url: 'models/mini-forest/bridge-wood-rope.glb', kit: 'mini-forest', scale: 5, min: [-0.521, 0, -0.401], max: [0.521, 0.473, 0.4], role: 'bridge', tris: 372, doubleSided: true }, // Wood-and-rope bridge for the river crossing (span along X).
  'target-archery': { url: 'models/mini-forest/target-archery.glb', kit: 'mini-forest', scale: 3, min: [-0.275, 0, -0.284], max: [0.275, 0.581, 0.187], role: 'target', tris: 188 }, // Archery target for the playground.
  'building-campus-main': { url: 'models/city-kit-suburban/building-campus-main.glb', kit: 'city-kit-suburban', scale: 8, min: [-0.892, 0, -0.689], max: [0.892, 1.138, 0.689], role: 'campus-building', tris: 1612 }, // Multi-wing building with green sloped roofs; main campus block.
  'building-campus-hostel': { url: 'models/city-kit-suburban/building-campus-hostel.glb', kit: 'city-kit-suburban', scale: 8, min: [-0.664, 0, -0.703], max: [0.65, 1.156, 0.703], role: 'campus-building', tris: 2062 }, // Two-storey building with dormer; hostel or second campus block.
  'building-office': { url: 'models/city-kit-commercial/building-office.glb', kit: 'city-kit-commercial', scale: 8, min: [-1.042, 0, -0.471], max: [1.042, 1.47, 0.471], role: 'office', tris: 2960 }, // Long four-storey office block (experience zone).
  'hut-floor': { url: 'models/holiday-kit/hut-floor.glb', kit: 'holiday-kit', scale: 2, min: [-0.5, 0, -0.5], max: [0.5, 0.075, 0.5], role: 'hut-piece', tris: 112 }, // Log-hut kit, 1 m grid. Assemble with manifest.hutRecipe.
  'hut-wall': { url: 'models/holiday-kit/hut-wall.glb', kit: 'holiday-kit', scale: 2, min: [-0.5, 0, 0.35], max: [0.5, 1, 0.65], role: 'hut-piece', tris: 84 }, // Log wall on the +Z edge of a 1 m cell; rotate around Y for other edges.
  'hut-wall-window': { url: 'models/holiday-kit/hut-wall-window.glb', kit: 'holiday-kit', scale: 2, min: [-0.5, 0, 0.3], max: [0.5, 1, 0.845], role: 'hut-piece', tris: 248 }, // Log wall with green window.
  'hut-wall-door': { url: 'models/holiday-kit/hut-wall-door.glb', kit: 'holiday-kit', scale: 2, min: [-0.5, 0, 0.3], max: [0.5, 1, 0.7], role: 'hut-piece', tris: 252 }, // Log wall with a door node 'door' and clips open / close / open-and-close.
  'hut-corner-logs': { url: 'models/holiday-kit/hut-corner-logs.glb', kit: 'holiday-kit', scale: 2, min: [-0.7, 0, 0.35], max: [-0.35, 1, 0.7], role: 'hut-piece', tris: 168 }, // Corner log post at the (-X,+Z) corner of a cell.
  'hut-gable-half': { url: 'models/holiday-kit/hut-gable-half.glb', kit: 'holiday-kit', scale: 2, min: [-0.5, 0, 0.35], max: [0.5, 1, 0.65], role: 'hut-piece', tris: 84 }, // Right-triangle half gable (45 deg); mirror with scale.x=-1 for the other half.
  'hut-roof-snow': { url: 'models/holiday-kit/hut-roof-snow.glb', kit: 'holiday-kit', scale: 2, min: [-0.5, -0.141, -0.7], max: [0.811, 1.337, 0.7], role: 'hut-piece', tris: 116 }, // Single-slope snowy roof for one 1 m cell; ridge at local x=-0.5.
  'avatar-male': { url: 'models/mini-characters/avatar-male.glb', kit: 'mini-characters', scale: 1.7, min: [-0.384, 0, -0.172], max: [0.384, 0.671, 0.168], role: 'avatar', tris: 723 }, // Avatar: smiling, black hair, round glasses, green tee; faces +Z. Skinned (7 joints) with 32 clips. No 'wave' clip: play 'idle' and add a sin
} satisfies Record<string, ModelInfo>;

export type ModelName = keyof typeof MODELS;
