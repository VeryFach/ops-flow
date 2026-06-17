/**
 * Lightweight representation of the authenticated user passed to service methods.
 * Services use this to branch on role (e.g. SUPER_ADMIN global access).
 */
export interface CurrentUser {
  id: string;
  role: string;
}
