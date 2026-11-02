import type { HTMLAttributes, ReactNode } from 'react';
import styles from './kit.module.css';

export interface PixelPanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  tone?: 'forest' | 'parchment' | 'dark';
  /** Optional heading in the pixel display font. */
  title?: ReactNode;
  titleLevel?: 2 | 3 | 4;
  as?: 'section' | 'div' | 'article' | 'aside';
}

/** A framed pixel panel. Body text inside keeps the readable body font. */
export function PixelPanel({ tone = 'forest', title, titleLevel = 2, as: Tag = 'section', className, children, ...rest }: PixelPanelProps) {
  const Heading = `h${titleLevel}` as 'h2';
  return (
    <Tag className={`${styles.panel} ${className ?? ''}`} data-tone={tone} {...rest}>
      {title ? <Heading className={styles.title}>{title}</Heading> : null}
      {children}
    </Tag>
  );
}
