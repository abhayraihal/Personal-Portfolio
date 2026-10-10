import { Text } from '@react-three/drei';
import type { ComponentProps } from 'react';
import { FONTS } from '../config/palette.ts';
import type { FontName } from '../config/palette.ts';
import { missingGlyphs } from '../config/glyphs.ts';
import { COLORS } from '../config/palette.ts';

type TextProps = ComponentProps<typeof Text>;

export type LabelProps = Omit<TextProps, 'font' | 'children'> & {
  children: string;
  font?: FontName; // 'body' | 'bodyBold' | 'display'
  size?: number; // metres (fontSize)
  flat?: boolean; // lie on the ground, reading towards the camera's up direction
};

// drei <Text> (troika SDF text) with the site's local fonts. Every character must exist in the
// font: a missing glyph makes troika fetch a fallback font from a CDN, so dev builds log an error.
export function Label({ children, font = 'body', size = 0.6, flat = false, color = COLORS.ink, rotation, ...rest }: LabelProps) {
  if (import.meta.env.DEV) {
    const missing = missingGlyphs(children, font);
    if (missing.length) console.error(`Label: font "${font}" has no glyph for ${missing.map((c) => JSON.stringify(c)).join(' ')} in "${children}"`);
  }
  return (
    <Text
      font={FONTS[font]}
      fontSize={size}
      color={color}
      anchorX="center"
      anchorY="middle"
      rotation={rotation ?? (flat ? [-Math.PI / 2, 0, 0] : undefined)}
      {...rest}
    >
      {children}
    </Text>
  );
}
