import { DoubleSide, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { COLORS } from '../../config/palette.ts';

// Shared materials for the plaza, created once. Toys that animate a colour own their materials.
const std = (color: string, roughness = 0.85, metalness = 0) => new MeshStandardMaterial({ color, roughness, metalness });

export const M = {
  plinthSide: std('#f0a43c', 0.8),
  plinthTop: std('#fbf2df', 0.9),
  stone: std('#e8dcc4', 0.9),
  stoneDark: std('#cdbb98', 0.9),
  orange: std(COLORS.amazon, 0.6),
  orangeDeep: std('#e07b00', 0.7),
  ink: std(COLORS.ink, 0.7),
  slate: std('#3b4354', 0.6, 0.15),
  metal: std('#8d96a8', 0.45, 0.4),
  paper: std(COLORS.paper, 0.9),
  white: std('#ffffff', 0.8),
  soil: std('#6b4a32', 1),
  planter: std('#d7c6a6', 0.9),
  cardboard: std('#c9925b', 0.95),
  tape: std('#e9c88f', 0.8),
  glass: new MeshStandardMaterial({ color: '#cfe9ff', roughness: 0.15, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false }),
  flagCloth: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, side: DoubleSide }),
  shadowDark: new MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.18, depthWrite: false }),
};
