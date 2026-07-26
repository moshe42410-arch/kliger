import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}

/**
 * Field wrapper — combines a label, input, help text, and error message
 * with consistent spacing and accessibility connections.
 *
 * Usage:
 *   <Field label="שם" htmlFor="name" required hint="השם המלא">
 *     <input id="name" className="input" />
 *   </Field>
 */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className = "",
}: FieldProps) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;

  return (
    <div className={`field ${className}`}>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="text-red-600 mr-1" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={hintId} className="help-text">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="error-text" role="alert">
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Row layout — 2+ columns on desktop, stacked on mobile.
 */
export function FieldRow({
  children,
  cols = 2,
  className = "",
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}) {
  const gridCols =
    cols === 3
      ? "sm:grid-cols-3"
      : cols === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-2";
  return <div className={`grid gap-4 ${gridCols} ${className}`}>{children}</div>;
}

/**
 * Actions bar at the bottom of a form — sticky on mobile, right-aligned on desktop.
 */
export function FormActions({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 mt-6 border-t border-navy-950/8 ${className}`}
    >
      {children}
    </div>
  );
}
