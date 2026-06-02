/** RFC 7807 ProblemDetails as returned by the API (FRONTEND_GUIDE §0.3). */
export interface ProblemDetails {
  status: number;
  title: string;
  detail?: string;
  /** Machine-readable code to switch on for UX text. */
  code?: string;
}

/** Standard list wrapper for paginated endpoints (FRONTEND_GUIDE §0.4). */
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}
