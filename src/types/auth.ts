export interface AdminUser {
  id: string;
  name: string;
  role: number; // 3 = Admin
}

/** Response from POST /bff/auth/login — the BFF's safe view (never any tokens). */
export interface BffLoginResponse {
  authenticated: boolean;
  user?: AdminUser;
  totpRequired?: boolean;
  totpEnrollmentNeeded?: boolean;
}

/** /bff/auth/totp/setup response (QR enrollment). */
export interface TotpSetup {
  qrCodeBase64: string; // "data:image/png;base64,..."
  manualEntryKey: string;
}
