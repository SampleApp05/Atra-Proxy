import { MessageStatus } from "./MessageStatus";
export enum ErrorCode {
  FETCH_FAILED = 1000,
  AUTHENTICATION_FAILED = 1001,
  INVALID_JSON = 1002,
  INVALID_VARIANT_FIELD = 1002,
  INVALID_QUERY_FIELD = 1004,
  INVALID_QUERY = 1005,
  INVALID_REQUEST_ID = 1006,
  INVALID_MAX_RESULTS = 1007,
  SEARCH_FAILED = 1008,
  UNEXPECTED_SERVER_ERROR = 1009,
}

export function buildSocketErrorResponse(
  code: ErrorCode,
  message: string | null = null,
  requestID: string | null = null
): string {
  return JSON.stringify({
    status: MessageStatus.ERROR,
    code,
    message: buildMessage(code, message),
    requestID,
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
