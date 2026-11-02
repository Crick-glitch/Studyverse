import { memo, useMemo, type CSSProperties } from 'react';
import { gridToPaths, type PixelGrid } from '../grid';
import { integerScale } from './scale';

export interface PixelGridSvgProps {
  grid: PixelGrid;
  scale?: number;
  /** Accessible name. Omit for decorative art (it is then hidden from assistive tech). */
  label?: string;
  flip?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders a palette grid as one `<path>` per colour. Integer coordinates + `crispEdges` means no blur at
 * any zoom, and nothing is injected as HTML: the markup is built by React from numbers and palette hex.
 */
function PixelGridSvgBase({ grid, scale = 1, label, flip = false, className, style }: PixelGridSvgProps) {
  const s = integerScale(scale, 'PixelGridSvg');
  const paths = useMemo(() => gridToPaths(grid), [grid]);
  return (
    <svg
      className={className}
      width={grid.w * s}
      height={grid.h * s}
      viewBox={`0 0 ${grid.w} ${grid.h}`}
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={{ imageRendering: 'pixelated', display: 'block', transform: flip ? 'scaleX(-1)' : undefined, ...style }}
    >
      {paths.map((p) => (
        <path key={p.color} d={p.d} fill={p.hex} />
      ))}
    </svg>
  );
}
export const PixelGridSvg = memo(PixelGridSvgBase);
