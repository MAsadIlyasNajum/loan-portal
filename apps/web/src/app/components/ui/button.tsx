import type { ButtonHTMLAttributes, JSX } from 'react';

export type ButtonVariant = 'primary' | 'outline' | 'ghost';

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly isLoading?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
};

export function Button({
  variant = 'primary',
  isLoading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps): JSX.Element {
  const classes = ['btn', VARIANT_CLASS[variant], className]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...rest}
    >
      {isLoading ? (
        <span
          className="spinner"
          style={{ width: '1rem', height: '1rem', margin: 0 }}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}

export default Button;
