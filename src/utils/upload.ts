import type { Express } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { env } from "../config/env";
import { ApiError } from "./apiError";

/**
 * Legacy on-disk copies (local/dev only). Production KYC photos are stored in
 * the database; Render's disk is ephemeral and must not be the source of truth.
 */
export const UPLOADS_ROOT = path.join(process.cwd(), "uploads");
export const ID_DOCUMENTS_DIR = path.join(UPLOADS_ROOT, "id-documents");

const ALLOWED_HEADER_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/x-png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/octet-stream",
]);

function ensureUploadDirsExist(): void {
  for (const dir of [UPLOADS_ROOT, ID_DOCUMENTS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
ensureUploadDirsExist();

function imageFileFilter(_req: Express.Request, file: Express.Multer.File, callback: multer.FileFilterCallback) {
  const mime = (file.mimetype || "").toLowerCase().split(";")[0]?.trim() ?? "";
  if (mime && !ALLOWED_HEADER_MIME_TYPES.has(mime)) {
    callback(ApiError.badRequest("errors.invalid_file_type"));
    return;
  }
  callback(null, true);
}

/** KYC uploads stay in memory and are persisted to the database — never to Render disk. */
export const idDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.DEPOSIT_PROOF_MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: imageFileFilter,
});

export function buildIdDocumentUrl(filename: string): string {
  return `/uploads/id-documents/${filename}`;
}

function sniffImageMime(data: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    data.length >= 12 &&
    data.slice(0, 4).toString("ascii") === "RIFF" &&
    data.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function looksLikeHeic(data: Buffer): boolean {
  if (data.length < 12) return false;
  if (data.slice(4, 8).toString("ascii") !== "ftyp") return false;
  const brand = data.slice(8, 12).toString("ascii").toLowerCase();
  return ["heic", "heif", "mif1", "msf1"].includes(brand);
}

function extensionForMime(mime: string): string {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".jpg";
}

export function readUploadedImage(file: Express.Multer.File): {
  filename: string;
  mime: string;
  data: Buffer;
} {
  const data = file.buffer?.length ? file.buffer : file.path ? fs.readFileSync(file.path) : Buffer.alloc(0);
  if (!data.length) {
    throw ApiError.badRequest("auth.id_document_required");
  }
  if (looksLikeHeic(data)) {
    throw ApiError.badRequest("errors.heic_not_supported");
  }
  const sniffed = sniffImageMime(data);
  if (!sniffed) {
    throw ApiError.badRequest("errors.invalid_file_type");
  }
  const filename = `${crypto.randomBytes(16).toString("hex")}${extensionForMime(sniffed)}`;
  return { filename, mime: sniffed, data };
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
