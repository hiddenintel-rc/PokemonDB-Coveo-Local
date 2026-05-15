/**
 * Paginated Search API export of the canonical YAML Push source (English).
 * Writes JSONL + a small manifest for local translation / re-push workflows.
 *
 * Usage (from repo root):
 *   node tools/coveo-locale-pipeline/src/export-yaml-source.mjs
 *
 * Reads `web/.env.local` then `web/.env` for NEXT_PUBLIC_COVEO_* (same as the app).
 */

import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

import {
  YAML_EXPORT_FIELDS_TO_INCLUDE,
  YAML_PUSH_SOURCE_DISPLAY_NAME,
} from "./fields.mjs";

const COVEO_SEARCH_ENDPOINT = "https://platform.cloud.coveo.com/rest/search/v2";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..");
const REPO_ROOT = join(PACKAGE_ROOT, "..", "..");
const OUTPUT_DIR = join(PACKAGE_ROOT, "output");
const JSONL_PATH = join(OUTPUT_DIR, "yaml-source-en.jsonl");
const MANIFEST_PATH = join(OUTPUT_DIR, "export-manifest.json");

/** Coveo may cap `numberOfResults`; shrink if you see HTTP 400 / invalidQuery. */
const PAGE_SIZE = 500;

function loadWebEnv() {
  const paths = [
    join(REPO_ROOT, "web", ".env.local"),
    join(REPO_ROOT, "web", ".env"),
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing ${name}. Set it in web/.env or web/.env.local (same keys as the Next.js app).`,
    );
  }
  return v;
}

async function postSearch(body) {
  const orgId = requireEnv("NEXT_PUBLIC_COVEO_ORG_ID");
  const apiKey = requireEnv("NEXT_PUBLIC_COVEO_API_KEY");
  const url = `${COVEO_SEARCH_ENDPOINT}?organizationId=${encodeURIComponent(orgId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Coveo Search API ${res.status} ${res.statusText}${errText ? `: ${errText.slice(0, 500)}` : ""}`,
    );
  }
  return res.json();
}

async function main() {
  loadWebEnv();

  const orgId = requireEnv("NEXT_PUBLIC_COVEO_ORG_ID");
  requireEnv("NEXT_PUBLIC_COVEO_API_KEY");
  const searchHub =
    process.env.NEXT_PUBLIC_COVEO_SEARCH_HUB?.trim() || "PokemonSearch";

  const sourceName =
    process.env.COVEO_YAML_SOURCE_NAME?.trim() || YAML_PUSH_SOURCE_DISPLAY_NAME;

  await mkdir(OUTPUT_DIR, { recursive: true });

  const out = createWriteStream(JSONL_PATH, { flags: "w", encoding: "utf8" });

  let firstResult = 0;
  let totalCount = Infinity;
  let written = 0;

  const cq = `@source=="${sourceName.replace(/"/g, '\\"')}"`;

  while (firstResult < totalCount) {
    const body = {
      organizationId: orgId,
      searchHub,
      cq,
      q: "",
      numberOfResults: PAGE_SIZE,
      firstResult,
      fieldsToInclude: YAML_EXPORT_FIELDS_TO_INCLUDE,
      analytics: { enabled: false },
    };

    const json = await postSearch(body);
    totalCount = json.totalCount ?? 0;
    const results = json.results ?? [];

    for (const hit of results) {
      const row = {
        uri: hit.uri,
        clickUri: hit.clickUri ?? hit.uri,
        title: hit.title,
        raw: hit.raw ?? {},
      };
      out.write(`${JSON.stringify(row)}\n`);
      written++;
    }

    if (results.length === 0) break;
    firstResult += results.length;
    process.stderr.write(
      `\rExported ${written} / ${totalCount === Infinity ? "?" : totalCount} …`,
    );
  }

  out.end();
  await new Promise((resolve, reject) => {
    out.on("finish", resolve);
    out.on("error", reject);
  });

  process.stderr.write("\n");

  const manifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sourceDisplayName: sourceName,
    totalDocuments: written,
    pageSize: PAGE_SIZE,
    jsonlRelative: "output/yaml-source-en.jsonl",
    fieldsToInclude: YAML_EXPORT_FIELDS_TO_INCLUDE,
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`Wrote ${written} rows → ${JSONL_PATH}`);
  console.log(`Manifest → ${MANIFEST_PATH}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
