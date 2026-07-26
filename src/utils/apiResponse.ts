import { Response } from "express";

export function sendSuccess<T>(res: Response, statusCode: number, message: string, data?: T): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data: data ?? null,
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  details?: unknown,
  messageKey?: string
): Response {
  return res.status(statusCode).json({
    success: false,
    message,
    messageKey: messageKey ?? null,
    details: details ?? null,
  });
}
