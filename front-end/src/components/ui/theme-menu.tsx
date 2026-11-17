"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";
const storageKey = "clipvelto-theme";
let fallbackTheme: Theme = "system";
const choices = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

function readTheme(): Theme {
  try {
    const value = localStorage.getItem(storageKey);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return fallbackTheme;
  }
}

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute("content", dark ? "#0c0f14" : "#fafaf8");
  });
}

function subscribe(onChange: () => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const update = () => {
    applyTheme(readTheme());
    onChange();
  };
  window.addEventListener("storage", update);
  window.addEventListener("theme-change", onChange);
  media.addEventListener("change", update);
  return () => {
    window.removeEventListener("storage", update);
    window.removeEventListener("theme-change", onChange);
    media.removeEventListener("change", update);
  };
}

export function ThemeMenu() {
  const theme = useSyncExternalStore(
    subscribe,
    readTheme,
    () => "system" as Theme,
  );
  return (
    <Menu>
      <MenuButton
        className="icon-button theme-trigger"
        aria-label="Choose color theme"
      >
        <Sun className="light-icon" size={19} aria-hidden="true" />
        <Moon className="dark-icon" size={19} aria-hidden="true" />
      </MenuButton>
      <MenuItems anchor="bottom end" className="theme-menu" modal={false}>
        {choices.map(({ value, label, icon: Icon }) => (
          <MenuItem key={value}>
            <button
              className="theme-option"
              onClick={() => {
                fallbackTheme = value;
                try {
                  localStorage.setItem(storageKey, value);
                } catch {
                  /* Keep the current selection usable without storage. */
                }
                applyTheme(value);
                window.dispatchEvent(new Event("theme-change"));
              }}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
              {theme === value && (
                <Check className="ml-auto" size={16} aria-label="Selected" />
              )}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}
