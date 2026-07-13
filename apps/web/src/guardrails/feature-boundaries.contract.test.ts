import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "..");
const FEATURES_ROOT = path.join(SRC_ROOT, "features");
const PUBLIC_ENTRYPOINTS = new Set(["client", "server", "actions", "types"]);

const ALLOWED_FEATURE_DEPENDENCIES: Record<string, readonly string[]> = {
  admin: ["billing", "properties"],
  auth: [],
  billing: [],
  chat: [],
  dashboard: ["billing", "properties"],
  leads: [],
  marketing: [],
  onboarding: ["properties"],
  partner: [],
  properties: [],
  "public-listings": ["properties"],
};

function sourceFiles(root: string): string[] {
  if (!statSafe(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [target] : [];
  });
}

function statSafe(target: string): boolean {
  try {
    return statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return ts.preProcessFile(source, true, true).importedFiles.map(({ fileName }) => fileName);
}

function featureOf(file: string): string | null {
  const relative = path.relative(FEATURES_ROOT, file).replaceAll("\\", "/");
  if (relative.startsWith("../")) return null;
  return relative.split("/")[0] || null;
}

function featureImport(specifier: string): { feature: string; entrypoint: string | null } | null {
  const match = specifier.match(/^@\/features\/([^/]+)(?:\/([^/]+))?/);
  if (!match) return null;
  return { feature: match[1], entrypoint: match[2] ?? null };
}

describe("feature architecture boundaries", () => {
  const files = sourceFiles(SRC_ROOT);

  it("does not allow features or shared infrastructure to import App Router internals", () => {
    const violations = files.flatMap((file) => {
      const owner = featureOf(file);
      const inSharedLib = file.startsWith(path.join(SRC_ROOT, "lib") + path.sep);
      if (!owner && !inSharedLib) return [];
      return importsOf(file)
        .filter((specifier) => specifier.startsWith("@/app/"))
        .map((specifier) => `${path.relative(SRC_ROOT, file)} -> ${specifier}`);
    });

    expect(violations).toEqual([]);
  });

  it("exposes feature code only through explicit client/server/actions/types entrypoints", () => {
    const violations = files.flatMap((file) => {
      const owner = featureOf(file);
      return importsOf(file).flatMap((specifier) => {
        const target = featureImport(specifier);
        if (!target || target.feature === owner) return [];
        if (target.entrypoint && PUBLIC_ENTRYPOINTS.has(target.entrypoint)) return [];
        return [`${path.relative(SRC_ROOT, file)} -> ${specifier}`];
      });
    });

    expect(violations).toEqual([]);
  });

  it("allows only the documented directed dependencies between features", () => {
    const edges = new Map<string, Set<string>>();
    const violations: string[] = [];

    for (const file of files) {
      const owner = featureOf(file);
      if (!owner) continue;
      for (const specifier of importsOf(file)) {
        const target = featureImport(specifier);
        if (!target || target.feature === owner) continue;
        const allowed = ALLOWED_FEATURE_DEPENDENCIES[owner] ?? [];
        if (!allowed.includes(target.feature)) {
          violations.push(`${owner} -> ${target.feature} (${path.relative(SRC_ROOT, file)})`);
        }
        const targets = edges.get(owner) ?? new Set<string>();
        targets.add(target.feature);
        edges.set(owner, targets);
      }
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    function visit(feature: string, chain: string[]): void {
      if (visiting.has(feature)) {
        violations.push(`cycle: ${[...chain, feature].join(" -> ")}`);
        return;
      }
      if (visited.has(feature)) return;
      visiting.add(feature);
      for (const target of edges.get(feature) ?? []) visit(target, [...chain, feature]);
      visiting.delete(feature);
      visited.add(feature);
    }
    for (const feature of edges.keys()) visit(feature, []);

    expect(violations).toEqual([]);
  });
});
