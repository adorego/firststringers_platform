// Minimal response shapes for e2e assertions — typed once at the point
// `res.body` is read, instead of casting each property access individually.

export interface ConversationResponse {
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  athleteId: string;
  recruiterId: string;
}

export interface RecruiterVerifyResponse {
  verificationStatus: string;
}

export interface RecruiterProfileResponse {
  name: string;
  verificationStatus: string;
  verifiedAt: string | null;
}

export interface AthleteResponse {
  name: string;
  role: string;
}

export interface DossierResponse {
  data: Record<string, unknown>;
  completeness: number;
}

export interface SendOtpResponse {
  sent: boolean;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
}
