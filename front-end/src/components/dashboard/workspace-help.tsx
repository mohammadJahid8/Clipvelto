"use client";

import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function WorkspaceHelp({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Disclosure as="div" className="workspace-help">
      <DisclosureButton type="button" className="workspace-help-toggle">
        {title}
        <ChevronDown size={16} aria-hidden="true" />
      </DisclosureButton>
      <DisclosurePanel className="workspace-help-content">{children}</DisclosurePanel>
    </Disclosure>
  );
}
