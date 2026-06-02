/** Hard redirect to the login screen. Isolated so the apiClient can call it
 *  without importing the router, and so tests can mock it. */
export function redirectToLogin(): void {
  window.location.assign('/login');
}
