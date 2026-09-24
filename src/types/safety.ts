/**
 * Gomegle Exact Age & Guardian Safety System
 * Type definitions & Data Contracts
 */

export type AgeGroup = 'Under 13' | '13–15' | '16–17' | '18+';

export type AgeVerificationStatus = 
  | 'UNVERIFIED' 
  | 'SELF_DECLARED' 
  | 'VERIFIED' 
  | 'REQUIRES_REVIEW';

export type GuardianConsentStatus = 
  | 'PENDING' 
  | 'VERIFIED' 
  | 'REVOKED' 
  | 'EXPIRED' 
  | 'NOT_REQUIRED';

export type AccountStatus = 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' | 'BANNED';

export interface DateOfBirth {
  day: number;   // 1 - 31
  month: number; // 1 - 12
  year: number;  // e.g. 2009
}

export interface JurisdictionPolicy {
  countryCode: string;
  countryName: string;
  minimumAgeToRegister: number; // e.g. 13 (USA COPPA), 14 (South Korea), 16 (Germany GDPR)
  guardianConsentRequiredUnder: number; // age under which guardian consent is mandatory (e.g. 18 or 16)
  under13AllowedWithSupervision: boolean;
  strictChatFiltering: boolean;
  ageBandMatchingOnly: boolean; // minors only match within exact age band
  regulatoryFramework: string; // "COPPA (USA)", "GDPR Art 8 (EU)", "AADC (UK)", "Online Safety Act (AU)"
}

export interface UserProfile {
  id: string;
  nickname: string;
  country: string; // e.g. "US", "UK", "DE", "KR", "AU"
  region?: string;
  
  // Strict Server-Controlled Fields (NEVER modifiable directly by client)
  date_of_birth: DateOfBirth;
  server_calculated_age: number; // calculated server-side only
  age_group: AgeGroup;
  age_verified: AgeVerificationStatus;
  guardian_required: boolean;
  guardian_status: GuardianConsentStatus;
  
  // Guardian details (Minimal info only)
  guardian_email?: string;
  guardian_consent_date?: string;
  guardian_revocation_date?: string;
  guardian_token?: string; // used for guardian dashboard auth
  
  // Privacy safe public attributes
  interests: string[];
  hobbies: string[];
  
  // Safety & Enforcement
  status: AccountStatus;
  moderation_strikes: number;
  blocked_user_ids: string[];
  created_at: string;
  last_dob_update_at?: string;
}

export interface PublicProfileView {
  id: string;
  nickname: string;
  country: string;
  region?: string;
  age_category: string; // "Teen (13–15)", "Teen (16–17)", "Adult (18+)" - NEVER exact DOB or exact age for minors!
  interests: string[];
  hobbies: string[];
  is_verified_minor?: boolean;
}

export interface MatchStepLog {
  stepNumber: number;
  title: string;
  passed: boolean;
  timestamp: string;
  details: string;
}

export interface MatchSession {
  id: string;
  user1Id: string;
  user2Id: string;
  ageGroup: AgeGroup;
  startedAt: string;
  endedAt?: string;
  token: string;
  peerProfile: PublicProfileView;
}

export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  senderName: string;
  isSenderMinor: boolean;
  text: string;
  originalText?: string;
  timestamp: string;
  isFlagged: boolean;
  flagReason?: string;
}

export interface SafetyReport {
  id: string;
  reporterId: string;
  reporterNickname: string;
  reportedUserId: string;
  reportedUserNickname: string;
  reason: 'UNDERAGE_ADULT_MISMATCH' | 'HARASSMENT' | 'INAPPROPRIATE_VIDEO' | 'SOLICITATION' | 'PII_LEAK' | 'OTHER';
  description: string;
  timestamp: string;
  status: 'OPEN' | 'REVIEWED' | 'DISMISSED' | 'ACTION_TAKEN';
  matchSessionId?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface GuardianAlert {
  id: string;
  userId: string;
  guardianEmail: string;
  eventType: 
    | 'ACCOUNT_SUSPENSION' 
    | 'SERIOUS_SAFETY_REPORT' 
    | 'MODERATION_VIOLATION' 
    | 'GUARDIAN_CONSENT_REVOKED' 
    | 'SECURITY_EVENT' 
    | 'DOB_MODIFICATION_ATTEMPT';
  severity: 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: 
    | 'REGISTRATION'
    | 'DOB_SUBMITTED' 
    | 'DOB_MODIFICATION_ATTEMPT' 
    | 'MATCH_ATTEMPT_PASSED'
    | 'MATCH_ATTEMPT_BLOCKED' 
    | 'GUARDIAN_CONSENT_GRANTED' 
    | 'GUARDIAN_CONSENT_REVOKED' 
    | 'SAFETY_REPORT_FILED' 
    | 'MODERATION_VIOLATION' 
    | 'ADMIN_ACTION'
    | 'VERIFICATION_STATUS_CHANGED';
  actorId: string;
  actorRole: 'SYSTEM' | 'USER' | 'GUARDIAN' | 'ADMIN';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  summary: string;
  details: Record<string, any>;
}

export interface VerificationRequest {
  id: string;
  userId: string;
  userNickname: string;
  claimedDob: DateOfBirth;
  method: 'GOVERNMENT_ID' | 'GUARDIAN_ATTESTATION' | 'FACIAL_AGE_ESTIMATION' | 'STUDENT_PASS';
  submittedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  documentType: string;
  notes?: string;
}
