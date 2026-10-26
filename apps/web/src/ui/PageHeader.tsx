import type { ReactNode } from 'react';
import { PixelIcon } from '../features/art/kit';
import type { NavIconId } from '../features/art/sprites/icons';
import common from './common.module.css';

interface Props {
  /** The id the page's `aria-labelledby` points at. */
  id: string;
  /** Pixel icon shown beside the title (decorative: the title text already names the page). */
  icon?: NavIconId;
  children: ReactNode;
}

/** The one `<h1>` of a screen: pixel icon, pixel-font title and a dashed pixel rule. */
export function PageHeader({ id, icon, children }: Props) {
  return (
    <div className={common.pageHeader}>
      <div className={common.pageHeading}>
        {icon ? <PixelIcon name={icon} scale={3} /> : null}
        <h1 id={id} className={common.pageTitle}>
          {children}
        </h1>
      </div>
      <div className={common.rule} aria-hidden="true" />
    </div>
  );
}
