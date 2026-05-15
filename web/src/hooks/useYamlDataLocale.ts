"use client";

import { useEffect, useState } from "react";
import {
  getYamlDataLocale,
  type YamlDataLocale,
  YAML_DATA_LOCALE_CHANGE_EVENT,
} from "@/coveo/yaml-data-locale";

/**
 * Tracks the YAML Push dataset locale (`en` | `es`) for UI that should mirror
 * {@link YamlDataLocaleSelect} without duplicating storage listeners.
 */
export function useYamlDataLocale(): YamlDataLocale {
  const [locale, setLocale] = useState<YamlDataLocale>(() =>
    typeof window === "undefined" ? "en" : getYamlDataLocale(),
  );

  useEffect(() => {
    const sync = () => setLocale(getYamlDataLocale());
    window.addEventListener(YAML_DATA_LOCALE_CHANGE_EVENT, sync);
    return () => window.removeEventListener(YAML_DATA_LOCALE_CHANGE_EVENT, sync);
  }, []);

  return locale;
}
