"use client";

import { useSyncExternalStore, type ComponentProps } from "react";

const subscribe = () => () => {};

export function ClientForm({ children, ...props }: ComponentProps<"form">) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <form {...props} aria-busy={!ready}>
      <fieldset disabled={!ready} className="form-fieldset">
        {children}
      </fieldset>
    </form>
  );
}
