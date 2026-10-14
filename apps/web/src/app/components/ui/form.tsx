import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  JSX,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

export function Label({
  children,
  ...rest
}: LabelHTMLAttributes<HTMLLabelElement>): JSX.Element {
  return <label {...rest}>{children}</label>;
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label?: string;
  readonly error?: string;
}

export function Input({
  label,
  error,
  id,
  className,
  ...rest
}: InputProps): JSX.Element {
  const fieldId = id ?? label;
  const classes = [
    'input',
    className,
    error ? 'is-invalid' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="field">
      {label ? (
        <Label htmlFor={fieldId} className="label">
          {label}
        </Label>
      ) : null}
      <input id={fieldId} className={classes} {...rest} />
      {error ? <span className="field-error" role="alert">
        {error}
      </span> : null}
    </div>
  );
}

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly label?: string;
  readonly error?: string;
}

export function Textarea({
  label,
  error,
  id,
  className,
  ...rest
}: TextareaProps): JSX.Element {
  const fieldId = id ?? label;
  const classes = ['input textarea', className, error ? 'is-invalid' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className="field">
      {label ? (
        <Label htmlFor={fieldId} className="label">
          {label}
        </Label>
      ) : null}
      <textarea id={fieldId} className={classes} {...rest} />
      {error ? <span className="field-error" role="alert">
        {error}
      </span> : null}
    </div>
  );
}

export interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement> {
  readonly label?: string;
  readonly error?: string;
  readonly placeholder?: string;
}

export function Select({
  label,
  error,
  id,
  className,
  placeholder,
  children,
  ...rest
}: SelectProps): JSX.Element {
  const fieldId = id ?? label;
  const classes = ['select', className, error ? 'is-invalid' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className="field">
      {label ? (
        <Label htmlFor={fieldId} className="label">
          {label}
        </Label>
      ) : null}
      <select id={fieldId} className={classes} {...rest}>
        {placeholder ? (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        ) : null}
        {children}
      </select>
      {error ? <span className="field-error" role="alert">
        {error}
      </span> : null}
    </div>
  );
}
