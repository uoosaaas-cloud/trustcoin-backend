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
  const data = file.buffer?.length ? file.buffer : fs.readFileSync(file.path);
  return {
    filename: file.filename || path.basename(file.path),
    mime: file.mimetype,
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

export function resolveStoredIdDocument(params: {
  data: Buffer | null;
  mime: string | null;
  path: string | null;
}): { data: Buffer; mime: string } | null {
  if (params.data && params.data.length > 0) {
    return { data: params.data, mime: params.mime || "image/jpeg" };
  }
  if (!params.path) return null;
  const fromDisk = readIdDocumentFromDisk(params.path);
  if (!fromDisk) return null;
  return { data: fromDisk, mime: params.mime || mimeFromFilename(params.path) };
}
