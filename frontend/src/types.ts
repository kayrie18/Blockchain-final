export type UserRole = 'Admin' | 'Issuer' | 'Verifier' | 'User';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization?: string;
  // profilePictureUrl intentionally kept optional, but UI may not use it after avatar cleanup.
  profilePictureUrl?: string;
  isVerifierApproved?: boolean;
  createdAt?: string;
}


export interface DocumentMetadata {
  title: string;
  owner: string;
  issuingOrganization: string;
  issueDate: string;
  type: string;
}

export interface DocumentRecord {
  id: string;
  title?: string;
  ownerName?: string;
  issuingOrganization?: string;
  documentType?: string;
  sha256Hash?: string;
  blockchain?: {
    transactionId?: string;
    confirmed?: boolean;
    blockNumber?: number;
    timestamp?: string;
    sha256HashHex?: string;
  } | null;
  // legacy
  hash?: string;

  uploadDate?: string;
  createdAt?: string;

  // status used across the UI
  status?: 'verified' | 'tampered' | 'pending' | 'Verified' | 'Tampered' | 'Pending' | string;

  expiryDate?: string;
  isRevoked?: boolean;

  verificationStatus?: string;
  isAuthentic?: boolean;

  issuerId?: string;

  qrCode?: string;
  ipfsCid?: string;
  storageProvider?: string;

  // allow extra backend fields without breaking typecheck
  [k: string]: any;
}


export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
  type: 'success' | 'warning' | 'info' | 'error';
}

export interface SystemStats {
  totalDocuments?: number;
  totalVerified?: number;
  totalIssuers?: number;
  systemHealth?: number;

  totalVerifications?: number;
  activeIssuers?: number;
  tamperAttempts?: number;

  [k: string]: any;
}

