import { forwardRef, type ButtonHTMLAttributes } from 'react';
import styles from './kit.module.css';

export interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  /** Force the pressed look (a toggled-on state); use `aria-pressed` for the semantics. */
  pressed?: boolean;
}

/** Four states from CSS alone: normal, hover, pressed, disabled. Always a real `<button>`. */
export const PixelButton = forwardRef<HTMLButtonElement, PixelButtonProps>(function PixelButton(
  { variant = 'secondary', pressed, type = 'button', className, ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={`${styles.button} ${className ?? ''}`} data-variant={variant} data-pressed={pressed ? 'true' : undefined} {...rest} />;
});
