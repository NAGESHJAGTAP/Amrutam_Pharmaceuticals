export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface UserProfile {
  id?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  emergencyContact?: string;
}

export interface DoctorDetails {
  id: string;
  licenseNumber: string;
  specialty: string;
  experienceYears: number;
  consultationFee: number;
  currency: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
}

export interface User {
  id: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  mfaEnabled: boolean;
  createdAt: string;
  firstName?: string;
  lastName?: string;
  profile?: UserProfile;
  doctor?: DoctorDetails;
  doctorProfile?: DoctorDetails;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSuccessData {
  user: User;
  tokens: AuthTokens;
}

export interface MfaChallengeData {
  requiresMfa: true;
  preAuthToken: string;
  message?: string;
}

export interface MfaSetupData {
  secret: string;
  qrCodeUri: string;
  backupCodes?: string[];
}
