"use client";

import { useEffect } from "react";
import { useYamlDataLocale } from "@/hooks/useYamlDataLocale";
import {
  getYamlDataLocale,
  setYamlDataLocale,
  type YamlDataLocale,
} from "@/coveo/yaml-data-locale";
import {
  coveoConfigured,
  refreshSearchAfterYamlDataLocaleChange,
} from "@/coveo/search-instance";

function onLocaleChange(next: YamlDataLocale) {
  if (getYamlDataLocale() === next) return;
  setYamlDataLocale(next);
  if (coveoConfigured()) {
    refreshSearchAfterYamlDataLocaleChange();
  }
}

export function YamlDataLocaleSelect() {
  const dataLocale = useYamlDataLocale();

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = dataLocale === "es" ? "es" : "en";
  }, [dataLocale]);

  return (
    <label className="flex items-center gap-2 text-xs font-medium text-zinc-600">
      <span className="sr-only">
        {dataLocale === "es"
          ? "Idioma de los datos de referencia YAML"
          : "YAML reference data language"}
      </span>
      <span className="hidden sm:inline text-zinc-500">
        {dataLocale === "es" ? "Datos" : "Data"}
      </span>
      <select
        value={dataLocale}
        onChange={(e) => {
          const v = e.target.value === "es" ? "es" : "en";
          onLocaleChange(v);
        }}
        className="cursor-pointer rounded-md border border-zinc-300 bg-white py-1.5 pl-2 pr-8 text-xs font-semibold text-zinc-800 shadow-sm outline-none ring-sky-500/30 hover:border-zinc-400 focus-visible:ring-4"
        aria-label={
          dataLocale === "es"
            ? "Idioma del conjunto de datos YAML"
            : "YAML reference data language"
        }
      >
        <option value="en">English</option>
        <option value="es">Español</option>
      </select>
    </label>
  );
}
