import type { Express } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { env } from "../config/env";
import { ApiError } from "./apiError";

/**
 * All uploaded files are written under `<project root>/uploads/...` and
 * served statically from `/uploads` (see `createApp` in `src/app.ts`). Kept
 * outside `src/` and `dist/` so it survives `tsc` rebuilds.
 */
export const UPLOADS_ROOT = path.join(process.cwd(), "uploads");
export const ID_DOCUMENTS_DIR = path.join(UPLOADS_ROOT, "id-documents");

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function ensureUploadDirsExist(): void {
  for (const dir of [UPLOADS_ROOT, ID_DOCUMENTS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
ensureUploadDirsExist();

function createImageStorage(destination: string) {
  return multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, destination),
    filename: (_req, file, callback) => {
      const randomName = crypto.randomBytes(16).toString("hex");
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${randomName}${extension}`);
    },
  });
}

function imageFileFilter(_req: Express.Request, file: Express.Multer.File, callback: multer.FileFilterCallback) {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    callback(ApiError.badRequest("errors.invalid_file_type"));
    return;
  }
  callback(null, true);
}

/** Multer for KYC ID/passport document uploads (`idDocument` field). */
export const idDocumentUpload = multer({
  storage: createImageStorage(ID_DOCUMENTS_DIR),
  limits: { fileSize: env.DEPOSIT_PROOF_MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: imageFileFilter,
});

export function buildIdDocumentUrl(filename: string): string {
  return `/uploads/id-documents/${filename}`;
}

export function readUploadedImage(file: Express.Multer.File): {
  filename: string;
  mime: string;
  data: Buffer;
} {
  const filename = file.filename || path.basename(file.path);
  const data = file.buffer?.length ? file.buffer : fs.readFileSync(file.path);
  return {
    filename,
    mime: normalizeImageMime(file.mimetype, filename),
    data,
  };
}

export function readIdDocumentFromDisk(relativePath: string): Buffer | null {
  const filename = path.basename(relativePath);
  if (!filename || filename.includes("..")) return null;
  const fullPath = path.join(ID_DOCUMENTS_DIR, filename);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath);
}

function mimeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

/** Browsers will not render a blob tagged `image/jpg`; always store `image/jpeg`. */
export function normalizeImageMime(mime: string | null | undefined, filename?: string): string {
  const value = (mime ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
  if (value === "image/jpeg" || value === "image/jpg" || value === "image/pjpeg") return "image/jpeg";
  if (value === "image/png" || value === "image/x-png") return "image/png";
  if (value === "image/webp") return "image/webp";
  return mimeFromFilename(filename ?? "");
}

export function bytesToBuffer(value: unknown): Buffer | null {
  if (value == null) return null;
  if (Buffer.isBuffer(value)) return value.length > 0 ? value : null;
  if (value instanceof Uint8Array) return value.byteLength > 0 ? Buffer.from(value) : null;
  return null;
}

export function resolveStoredIdDocument(params: {
  data: Buffer | null;
  mime: string | null;
  path: string | null;
}): { data: Buffer; mime: string } | null {
  if (params.data && params.data.length > 0) {
    return { data: params.data, mime: normalizeImageMime(params.mime) };
  }
  if (!params.path) return null;
  const fromDisk = readIdDocumentFromDisk(params.path);
  if (!fromDisk) return null;
  return { data: fromDisk, mime: normalizeImageMime(params.mime, params.path) };
}
