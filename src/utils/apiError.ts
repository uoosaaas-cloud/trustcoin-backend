export type TranslationParams = Record<string, string | number>;

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly messageKey: string;
  public readonly details?: unknown;
  /** Values interpolated into the translated message, e.g. `{{seconds}}`. */
  public readonly params?: TranslationParams;

  constructor(statusCode: number, messageKey: string, details?: unknown, params?: TranslationParams) {
    super(messageKey);
    this.statusCode = statusCode;
    this.messageKey = messageKey;
    this.details = details;
    this.params = params;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(messageKey: string, details?: unknown, params?: TranslationParams): ApiError {
    return new ApiError(400, messageKey, details, params);
  }

  static unauthorized(messageKey = "errors.unauthorized"): ApiError {
    return new ApiError(401, messageKey);
  }

  static forbidden(messageKey = "errors.forbidden"): ApiError {
    return new ApiError(403, messageKey);
  }

  static notFound(messageKey = "errors.not_found"): ApiError {
    return new ApiError(404, messageKey);
  }

  static conflict(messageKey: string, details?: unknown): ApiError {
    return new ApiError(409, messageKey, details);
  }

  static tooManyRequests(messageKey = "errors.too_many_requests", params?: TranslationParams): ApiError {
    return new ApiError(429, messageKey, undefined, params);
  }

  static internal(messageKey = "errors.internal_server_error"): ApiError {
    return new ApiError(500, messageKey);
  }

  static serviceUnavailable(messageKey = "errors.service_unavailable"): ApiError {
    return new ApiError(503, messageKey);
  }
}
