// ---------------------------------------------------------------------------
// Domain errors — map to HTTP status codes at the route layer
// ---------------------------------------------------------------------------

/** Thrown when the caller's baseVersion does not match the stored version.
 *  Route layer should return HTTP 409 Conflict. */
export class StaleVersionError extends Error {
  readonly status = 409 as const;
  constructor(message = "다른 팀원이 먼저 수정했습니다. 최신 내용을 불러온 뒤 다시 시도해 주세요.") {
    super(message);
    this.name = "StaleVersionError";
  }
}

/** Thrown when input fails business-rule validation.
 *  Route layer should return HTTP 400 Bad Request. */
export class ValidationError extends Error {
  readonly status = 400 as const;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Thrown when a requested record does not exist.
 *  Route layer should return HTTP 404 Not Found. */
export class NotFoundError extends Error {
  readonly status = 404 as const;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
