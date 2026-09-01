#!/usr/bin/env node
/**
 * Prepares the local, Git-external document tree for the planned manual S3
 * document-rebuild workflow. This command only writes under
 * CURI_RAG_STAGING_DIR (default: /tmp/curi-rag-documents); it never uploads,
 * creates a local index, or participates in the deployed runtime.
 *
 * Usage:
 *   node scripts/prepare-rag-documents.mjs
 *   CURI_RAG_STAGING_DIR=/tmp/curi-rag node scripts/prepare-rag-documents.mjs
 *
 * Optional source ZIP overrides:
 *   CURI_LIBERAL_ARTS_ZIP, CURI_ARCHITECTURE_ZIP,
 *   CURI_COMPUTER_ENGINEERING_ZIP, CURI_ACCOUNTING_TAX_ZIP
 */

import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const sourceZipDirectory = path.resolve(repositoryRoot, "..", "BTS");
const stagingDirectory = canonicalizeStagingDirectory(
  process.env.CURI_RAG_STAGING_DIR?.trim() || path.join(tmpdir(), "curi-rag-documents"),
);
const documentsDirectory = resolveWithinStaging("documents");
const courseMapPath = path.join(scriptDirectory, "rag-course-map.json");

const archives = new Map([
  [
    "교양 - 이러닝.zip",
    {
      department: "교양",
      zipPath: configuredZipPath("CURI_LIBERAL_ARTS_ZIP", "교양 - 이러닝.zip"),
    },
  ],
  [
    "광주대 건축학과 강의계획서.zip",
    {
      department: "건축학과",
      zipPath: configuredZipPath("CURI_ARCHITECTURE_ZIP", "광주대 건축학과 강의계획서.zip"),
    },
  ],
  [
    "광주대 컴퓨터공학과 강의계획서.zip",
    {
      department: "컴퓨터공학과",
      zipPath: configuredZipPath("CURI_COMPUTER_ENGINEERING_ZIP", "광주대 컴퓨터공학과 강의계획서.zip"),
    },
  ],
  [
    "광주대 회계세무학과 강의계획서.zip",
    {
      department: "회계세무학과",
      zipPath: configuredZipPath("CURI_ACCOUNTING_TAX_ZIP", "광주대 회계세무학과 강의계획서.zip"),
    },
  ],
]);

function canonicalizeStagingDirectory(requestedDirectory) {
  const missingSegments = [];
  let existingAncestor = path.resolve(requestedDirectory);

  while (!existsSync(existingAncestor)) {
    const parentDirectory = path.dirname(existingAncestor);
    if (parentDirectory === existingAncestor) {
      throw new Error(`Could not resolve a staging directory ancestor: ${requestedDirectory}`);
    }
    missingSegments.unshift(path.basename(existingAncestor));
    existingAncestor = parentDirectory;
  }

  return path.resolve(realpathSync(existingAncestor), ...missingSegments);
}

function configuredZipPath(environmentVariable, defaultFilename) {
  return path.resolve(process.env[environmentVariable]?.trim() || path.join(sourceZipDirectory, defaultFilename));
}

function resolveWithinStaging(...segments) {
  const target = path.resolve(stagingDirectory, ...segments);
  const relativeTarget = path.relative(stagingDirectory, target);

  if (
    relativeTarget === "" ||
    relativeTarget === ".." ||
    relativeTarget.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeTarget)
  ) {
    throw new Error(`Refusing to write outside the staging directory: ${target}`);
  }

  return target;
}

function assertStagingOutsideRepository() {
  const relativeStagingDirectory = path.relative(repositoryRoot, stagingDirectory);
  const isInsideRepository =
    relativeStagingDirectory === "" ||
    (relativeStagingDirectory !== ".." &&
      !relativeStagingDirectory.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativeStagingDirectory));

  if (isInsideRepository) {
    throw new Error("CURI_RAG_STAGING_DIR must be outside the Git repository.");
  }
}

function assertSafeMapEntry(entry, index, seenCourseIds, seenDocuments) {
  if (!entry || typeof entry !== "object") {
    throw new Error(`Course map entry ${index} must be an object.`);
  }

  for (const field of ["archive", "department", "filename", "sourcePath", "courseId"]) {
    if (typeof entry[field] !== "string" || entry[field].trim() === "") {
      throw new Error(`Course map entry ${index} has no valid ${field}.`);
    }
  }

  const archive = archives.get(entry.archive);
  if (!archive) {
    throw new Error(`Course map entry ${index} references an unknown archive: ${entry.archive}`);
  }
  if (entry.department !== archive.department) {
    throw new Error(`Course map entry ${index} does not match ${entry.archive}'s department.`);
  }
  if (
    !entry.filename.endsWith(".pdf") ||
    entry.filename.includes("\\") ||
    path.basename(entry.filename) !== entry.filename
  ) {
    throw new Error(`Course map entry ${index} has an unsafe PDF filename.`);
  }
  if (
    entry.sourcePath.includes("\\") ||
    path.posix.isAbsolute(entry.sourcePath) ||
    entry.sourcePath.split("/").includes("..") ||
    path.posix.normalize(entry.sourcePath) !== entry.sourcePath ||
    path.posix.basename(entry.sourcePath) !== entry.filename
  ) {
    throw new Error(`Course map entry ${index} has an unsafe archive path.`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.courseId)) {
    throw new Error(`Course map entry ${index} has an unsafe courseId.`);
  }

  if (seenCourseIds.has(entry.courseId)) {
    throw new Error(`Duplicate courseId in the course map: ${entry.courseId}`);
  }
  const documentKey = `${entry.archive}\u0000${entry.sourcePath}`;
  if (seenDocuments.has(documentKey)) {
    throw new Error(`Duplicate document in the course map: ${entry.archive}/${entry.sourcePath}`);
  }

  seenCourseIds.add(entry.courseId);
  seenDocuments.add(documentKey);
}

function readCourseMap() {
  const map = JSON.parse(readFileSync(courseMapPath, "utf8"));
  if (!Array.isArray(map) || map.length !== 77) {
    throw new Error("scripts/rag-course-map.json must contain exactly 77 course entries.");
  }

  const seenCourseIds = new Set();
  const seenDocuments = new Set();
  map.forEach((entry, index) => assertSafeMapEntry(entry, index, seenCourseIds, seenDocuments));
  return map;
}

function readPdfFromArchive(zipPath, sourcePath) {
  if (!existsSync(zipPath) || !statSync(zipPath).isFile()) {
    throw new Error(`Syllabus ZIP was not found: ${zipPath}`);
  }

  const extractor = [
    "import sys, unicodedata, zipfile",
    "archive, requested = sys.argv[1:3]",
    "target = unicodedata.normalize('NFC', requested)",
    "with zipfile.ZipFile(archive) as source:",
    "    matches = [name for name in source.namelist() if unicodedata.normalize('NFC', name) == target]",
    "    if len(matches) != 1: raise SystemExit(f'expected one normalized member, found {len(matches)}')",
    "    sys.stdout.buffer.write(source.read(matches[0]))",
  ].join("\n");
  const result = spawnSync("python3", ["-c", extractor, zipPath, sourcePath], {
    encoding: null,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error || result.status !== 0 || !result.stdout?.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    const detail = result.error?.message || result.stderr?.toString().trim() || "not a readable PDF";
    throw new Error(`Could not read ${sourcePath} from ${zipPath}: ${detail}`);
  }

  return result.stdout;
}

function main() {
  assertStagingOutsideRepository();
  const courseMap = readCourseMap();

  rmSync(documentsDirectory, { force: true, recursive: true });
  mkdirSync(documentsDirectory, { recursive: true });

  for (const entry of courseMap) {
    const archive = archives.get(entry.archive);
    const courseDirectory = resolveWithinStaging("documents", entry.courseId);
    const pdfPath = resolveWithinStaging("documents", entry.courseId, entry.filename);
    const metadataPath = resolveWithinStaging("documents", entry.courseId, `${entry.filename}.metadata.json`);
    const pdf = readPdfFromArchive(archive.zipPath, entry.sourcePath);

    mkdirSync(courseDirectory, { recursive: true });
    writeFileSync(pdfPath, pdf, { flag: "wx" });
    writeFileSync(
      metadataPath,
      `${JSON.stringify(
        {
          metadataAttributes: {
            courseId: entry.courseId,
            courseName: entry.filename.slice(0, -".pdf".length),
            department: entry.department,
          },
        },
        null,
        2,
      )}\n`,
      { encoding: "utf8", flag: "wx" },
    );
  }

  console.log(`Prepared ${courseMap.length} RAG documents in ${documentsDirectory}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
