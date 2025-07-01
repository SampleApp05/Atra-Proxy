import { MessageStatus } from "./MessageStatus";
export enum ErrorCode {
  FETCH_FAILED = 1000,
  AUTHENTICATION_FAILED = 1001,
  INVALID_JSON = 1002,
  INVALID_VARIANT_FIELD = 1003,
  INVALID_QUERY_FIELD = 1004,
  INVALID_QUERY = 1005,
  INVALID_REQUEST_ID = 1006,
  INVALID_MAX_RESULTS = 1007,
  SEARCH_FAILED = 1008,
  UNEXPECTED_SERVER_ERROR = 1009,
}

export function buildSocketErrorResponse(
  code: ErrorCode,
  action: String,
  message: string | null = null,
  requestID: string | null = null
): string {
  return JSON.stringify({
    status: MessageStatus.ERROR,
    code,
    message: buildMessage(code, message),
    action,
    requestID,
    timestamp: new Date().toISOString(), // Add timestamp for frontend correlation
    severity: getSeverity(code) // Add severity level
  });
}

export function buildSocketErrorResponseWithOriginal(
  code: ErrorCode,
  action: String,
  originalMessage: string,
  message: string | null = null,
  requestID: string | null = null
): string {
  return JSON.stringify({
    status: MessageStatus.ERROR,
    code,
    message: buildMessage(code, message),
    action,
    requestID,
    originalMessage, // Include the original message for correlation
    timestamp: new Date().toISOString(),
    severity: getSeverity(code)
  });
}

function buildMessage(code: ErrorCode, message: string | null): string {
  if (message) {
    return message;
  }
  switch (code) {
    case ErrorCode.AUTHENTICATION_FAILED:
      return "Authentication failed";
    case ErrorCode.INVALID_JSON:
      return "Invalid JSON format";
    case ErrorCode.INVALID_VARIANT_FIELD:
      return "Invalid type field in request";
    case ErrorCode.INVALID_QUERY_FIELD:
      return "Invalid query field in request";
    case ErrorCode.INVALID_QUERY:
      return "Invalid query";
    case ErrorCode.INVALID_REQUEST_ID:
      return "Invalid request ID";
    case ErrorCode.INVALID_MAX_RESULTS:
      return "Invalid max results value";
    case ErrorCode.SEARCH_FAILED:
      return "Search operation failed";
    case ErrorCode.UNEXPECTED_SERVER_ERROR:
      return "Unexpected server error";
    default:
      return "Unknown error occurred";
  }
}

function getSeverity(code: ErrorCode): 'low' | 'medium' | 'high' | 'critical' {
  switch (code) {
    case ErrorCode.INVALID_MAX_RESULTS:
    case ErrorCode.INVALID_QUERY:
      return 'low';
    case ErrorCode.INVALID_JSON:
    case ErrorCode.INVALID_VARIANT_FIELD:
    case ErrorCode.INVALID_REQUEST_ID:
      return 'medium';
    case ErrorCode.SEARCH_FAILED:
    case ErrorCode.FETCH_FAILED:
      return 'high';
    case ErrorCode.AUTHENTICATION_FAILED:
    case ErrorCode.UNEXPECTED_SERVER_ERROR:
      return 'critical';
    default:
      return 'medium';
  }
}
