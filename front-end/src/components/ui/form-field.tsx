"use client";

import { Field, Label, Input, Description } from "@headlessui/react";
import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentProps } from "react";

type FormFieldProps = ComponentProps<"input"> & {
  label: string;
  error?: string;
  hint?: string;
};

export function FormField({
  label,
  error,
  hint,
  type = "text",
  ...props
}: FormFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const password = type === "password";
  return (
    <Field className="form-field">
      <Label htmlFor={id} className="form-label">
        {label}
      </Label>
      <div className="input-wrap">
        <Input
          as="input"
          {...props}
          id={id}
          type={password && visible ? "text" : type}
          className={`form-input${password ? " password-input" : ""}`}
          invalid={!!error}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
        />
        {password && (
          <button
            type="button"
            className="password-toggle icon-button"
            aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? (
              <EyeOff size={18} aria-hidden="true" />
            ) : (
              <Eye size={18} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {error ? (
        <Description id={`${id}-error`} className="field-error">
          {error}
        </Description>
      ) : hint ? (
        <Description id={`${id}-hint`} className="field-hint">
          {hint}
        </Description>
      ) : null}
    </Field>
  );
}
