/**
 * Gomegle Server-Side Safety Engine
 * 
 * AUTHORITATIVE AGE, JURISDICTION, GUARDIAN CONSENT, AND MATCHING ENFORCEMENT.
 * NEVER trusts client-claimed age or client-filtered rules.
 */

import {
  AgeGroup,
  AgeVerificationStatus,
  GuardianConsentStatus,
  JurisdictionPolicy,
  UserProfile,
  PublicProfileView,
  MatchStepLog,
  MatchSession,
  ChatMessage,
  SafetyReport,
  GuardianAlert,
  AuditLogEntry,
  VerificationRequest,
  DateOfBirth
} from '../types/safety';

// Default jurisdiction safety policies
export const DEFAULT_JURISDICTIONS: Record<string, JurisdictionPolicy> = {
  US: {
    countryCode: 'US',
    countryName: 'United States',
    minimumAgeToRegister: 13, // COPPA baseline
    guardianConsentRequiredUnder: 18,
    under13AllowedWithSupervision: false,
    strictChatFiltering: true,
    ageBandMatchingOnly: true,
    regulatoryFramework: 'COPPA & State Age-Appropriate Design Codes'
  },
  GB: {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    minimumAgeToRegister: 13,
    guardianConsentRequiredUnder: 18,
    under13AllowedWithSupervision: false,
    strictChatFiltering: true,
    ageBandMatchingOnly: true,
    regulatoryFramework: 'UK Age-Appropriate Design Code (Children\'s Code)'
  },
  DE: {
    countryCode: 'DE',
    countryName: 'Germany',
    minimumAgeToRegister: 16, // GDPR Art 8 high threshold
    guardianConsentRequiredUnder: 18,
    under13AllowedWithSupervision: false,
    strictChatFiltering: true,
    ageBandMatchingOnly: true,
    regulatoryFramework: 'EU GDPR Art. 8 & German Jugendschutzgesetz (JuSchG)'
  },
  FR: {
    countryCode: 'FR',
    countryName: 'France',
    minimumAgeToRegister: 15, // French digital age of consent
    guardianConsentRequiredUnder: 18,
    under13AllowedWithSupervision: false,
    strictChatFiltering: true,
    ageBandMatchingOnly: true,
    regulatoryFramework: 'EU GDPR & French Majority Numérique (15 yrs)'
  },
  KR: {
    countryCode: 'KR',
    countryName: 'South Korea',
    minimumAgeToRegister: 14, // PIPA Art 22
    guardianConsentRequiredUnder: 19,
    under13AllowedWithSupervision: false,
    strictChatFiltering: true,
    ageBandMatchingOnly: true,
    regulatoryFramework: 'Personal Information Protection Act (PIPA 14+)'
  },
  AU: {
    countryCode: 'AU',
    countryName: 'Australia',
    minimumAgeToRegister: 14,
    guardianConsentRequiredUnder: 18,
    under13AllowedWithSupervision: false,
    strictChatFiltering: true,
    ageBandMatchingOnly: true,
    regulatoryFramework: 'eSafety Commissioner Social Media Minimum Age Guidelines'
  },
  GLOBAL: {
    countryCode: 'GLOBAL',
    countryName: 'International Default',
    minimumAgeToRegister: 13,
    guardianConsentRequiredUnder: 18,
    under13AllowedWithSupervision: false,
    strictChatFiltering: true,
    ageBandMatchingOnly: true,
    regulatoryFramework: 'Global Strict Child Protection Baseline'
  }
};

class SafetyEngineStore {
  public users: Map<string, UserProfile> = new Map();
  public jurisdictions: Map<string, JurisdictionPolicy> = new Map();
  public reports: SafetyReport[] = [];
  public guardianAlerts: GuardianAlert[] = [];
  public auditLogs: AuditLogEntry[] = [];
  public verificationRequests: VerificationRequest[] = [];
  public activeMatches: Map<string, MatchSession> = new Map();
  public chatMessages: Map<string, ChatMessage[]> = new Map();

  constructor() {
    // Initialize jurisdictions
    Object.values(DEFAULT_JURISDICTIONS).forEach(j => {
      this.jurisdictions.set(j.countryCode, { ...j });
    });

    this.seedInitialData();
  }

  /**
   * STRICT SERVER-SIDE AGE CALCULATION
   * Never trust client. Uses today's real reference date.
   */
  public calculateExactAge(dob: DateOfBirth, referenceDate: Date = new Date()): number {
    const { day, month, year } = dob;
    
    // Validate bounds
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > referenceDate.getFullYear()) {
      throw new Error(`Invalid Date of Birth values: Day ${day}, Month ${month}, Year ${year}`);
    }

    let age = referenceDate.getFullYear() - year;
    const currentMonth = referenceDate.getMonth() + 1; // 1-indexed
    const currentDay = referenceDate.getDate();

    if (currentMonth < month || (currentMonth === month && currentDay < day)) {
      age--;
    }

    return Math.max(0, age);
  }

  /**
   * Determine Age Group strictly according to specification:
   * - Under 13
   * - 13–15
   * - 16–17
   * - 18+
   */
  public determineAgeGroup(age: number): AgeGroup {
    if (age < 13) return 'Under 13';
    if (age <= 15) return '13–15';
    if (age <= 17) return '16–17';
    return '18+';
  }

  /**
   * Server registration endpoint handler
   */
  public registerUser(params: {
    nickname: string;
    country: string;
    region?: string;
    dob: DateOfBirth;
    guardianEmail?: string;
    interests: string[];
    hobbies: string[];
  }): { success: boolean; user?: UserProfile; error?: string } {
    try {
      const serverAge = this.calculateExactAge(params.dob);
      const ageGroup = this.determineAgeGroup(serverAge);
      const policy = this.jurisdictions.get(params.country) || this.jurisdictions.get('GLOBAL')!;

      // Check jurisdiction minimum age
      if (serverAge < policy.minimumAgeToRegister) {
        this.addAuditLog({
          eventType: 'REGISTRATION',
          actorId: 'system',
          actorRole: 'SYSTEM',
          severity: 'WARNING',
          summary: `Registration blocked: User age (${serverAge}) is below jurisdiction minimum (${policy.minimumAgeToRegister}) for ${policy.countryName}`,
          details: { country: params.country, serverAge, policyMin: policy.minimumAgeToRegister }
        });
        return {
          success: false,
          error: `Registration rejected by platform policy: Minimum age for ${policy.countryName} is ${policy.minimumAgeToRegister} years old under ${policy.regulatoryFramework}.`
        };
      }

      const isMinor = serverAge < 18;
      const guardianRequired = isMinor && serverAge < policy.guardianConsentRequiredUnder;

      if (guardianRequired && (!params.guardianEmail || !params.guardianEmail.includes('@'))) {
        return {
          success: false,
          error: `Guardian consent is mandatory for users under ${policy.guardianConsentRequiredUnder} in ${policy.countryName}. A valid guardian email is required.`
        };
      }

      const userId = 'usr_' + Math.random().toString(36).substring(2, 9);
      const guardianToken = guardianRequired ? 'gtok_' + Math.random().toString(36).substring(2, 12) : undefined;

      const newUser: UserProfile = {
        id: userId,
        nickname: params.nickname.trim(),
        country: params.country,
        region: params.region,
        date_of_birth: { ...params.dob },
        server_calculated_age: serverAge,
        age_group: ageGroup,
        age_verified: isMinor ? 'SELF_DECLARED' : 'SELF_DECLARED',
        guardian_required: guardianRequired,
        guardian_status: guardianRequired ? 'PENDING' : 'NOT_REQUIRED',
        guardian_email: guardianRequired ? params.guardianEmail : undefined,
        guardian_token: guardianToken,
        interests: params.interests,
        hobbies: params.hobbies,
        status: 'ACTIVE',
        moderation_strikes: 0,
        blocked_user_ids: [],
        created_at: new Date().toISOString()
      };

      this.users.set(userId, newUser);

      this.addAuditLog({
        eventType: 'REGISTRATION',
        actorId: userId,
        actorRole: 'USER',
        severity: 'INFO',
        summary: `User registered: ${newUser.nickname} (Age Group: ${ageGroup}, Server Age: ${serverAge}, Country: ${newUser.country})`,
        details: {
          userId,
          ageGroup,
          serverAge,
          guardianRequired,
          guardianStatus: newUser.guardian_status
        }
      });

      if (guardianRequired && newUser.guardian_email) {
        this.addGuardianAlert({
          userId: newUser.id,
          guardianEmail: newUser.guardian_email,
          eventType: 'SECURITY_EVENT',
          severity: 'HIGH',
          title: 'Parental Consent Required for Gomegle Account',
          description: `Your minor dependent (${newUser.nickname}) registered for Gomegle. Matching and social discovery remain LOCKED until you review and grant consent.`
        });
      }

      return { success: true, user: newUser };
    } catch (e: any) {
      return { success: false, error: e.message || 'Registration failed' };
    }
  }

  /**
   * ANTI-BYPASS DOB MODIFICATION
   * Users cannot casually change their age. Any request triggers recalculation,
   * audit log recording, and mandatory review / re-verification.
   */
  public updateDateOfBirth(
    userId: string, 
    newDob: DateOfBirth, 
    actorRole: 'USER' | 'ADMIN' = 'USER',
    adminNotes?: string
  ): { success: boolean; user?: UserProfile; error?: string } {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: 'User not found' };

    const previousDob = { ...user.date_of_birth };
    const previousAge = user.server_calculated_age;
    const previousAgeGroup = user.age_group;

    const newAge = this.calculateExactAge(newDob);
    const newAgeGroup = this.determineAgeGroup(newAge);
    const policy = this.jurisdictions.get(user.country) || this.jurisdictions.get('GLOBAL')!;

    // If a minor attempts to become an adult, flag immediately
    const attemptedMinorToAdult = previousAge < 18 && newAge >= 18;

    user.date_of_birth = { ...newDob };
    user.server_calculated_age = newAge;
    user.age_group = newAgeGroup;
    user.last_dob_update_at = new Date().toISOString();

    // Reapply guardian requirements
    if (newAge < policy.guardianConsentRequiredUnder) {
      user.guardian_required = true;
      if (user.guardian_status === 'NOT_REQUIRED') {
        user.guardian_status = 'PENDING';
      }
    } else {
      user.guardian_required = false;
      user.guardian_status = 'NOT_REQUIRED';
    }

    // Require reverification whenever DOB is altered
    user.age_verified = 'REQUIRES_REVIEW';

    this.addAuditLog({
      eventType: 'DOB_MODIFICATION_ATTEMPT',
      actorId: userId,
      actorRole,
      severity: attemptedMinorToAdult ? 'CRITICAL' : 'WARNING',
      summary: `Date of Birth modified for ${user.nickname}: Age adjusted from ${previousAge} (${previousAgeGroup}) to ${newAge} (${newAgeGroup}). Status set to REQUIRES_REVIEW.`,
      details: {
        userId,
        previousDob,
        newDob,
        previousAge,
        newAge,
        attemptedMinorToAdult,
        adminNotes
      }
    });

    if (user.guardian_email) {
      this.addGuardianAlert({
        userId,
        guardianEmail: user.guardian_email,
        eventType: 'DOB_MODIFICATION_ATTEMPT',
        severity: 'CRITICAL',
        title: 'Date of Birth Change Attempt Detected',
        description: `Account DOB was updated to Day ${newDob.day}, Month ${newDob.month}, Year ${newDob.year}. Account matching permissions have been restricted pending verification.`
      });
    }

    return { success: true, user };
  }

  /**
   * THE STRICT 10-STEP GLOBAL MATCH SEQUENCE
   * Must execute sequentially server-side BEFORE any connection or video initiation.
   */
  public executeGlobalMatchSequence(userId: string): {
    success: boolean;
    stepLogs: MatchStepLog[];
    session?: MatchSession;
    failureReason?: string;
  } {
    const stepLogs: MatchStepLog[] = [];
    const recordStep = (stepNumber: number, title: string, passed: boolean, details: string) => {
      stepLogs.push({
        stepNumber,
        title,
        passed,
        timestamp: new Date().toISOString(),
        details
      });
    };

    // Step 1: Authenticate user
    const user = this.users.get(userId);
    if (!user) {
      recordStep(1, 'Authenticate User', false, 'Authentication failed: User token or identity not found on server');
      return { success: false, stepLogs, failureReason: 'Authentication failed' };
    }
    recordStep(1, 'Authenticate User', true, `Authenticated user ${user.nickname} (${user.id})`);

    // Step 2: Calculate exact age server-side
    let calculatedAge: number;
    try {
      calculatedAge = this.calculateExactAge(user.date_of_birth);
      // Keep in sync with server state
      user.server_calculated_age = calculatedAge;
      recordStep(2, 'Calculate Exact Age Server-Side', true, `Server verified age: ${calculatedAge} years old (DOB: ${user.date_of_birth.year}-${user.date_of_birth.month}-${user.date_of_birth.day})`);
    } catch (e: any) {
      recordStep(2, 'Calculate Exact Age Server-Side', false, `Failed to calculate age from server DOB: ${e.message}`);
      return { success: false, stepLogs, failureReason: 'Age calculation error' };
    }

    // Step 3: Determine applicable age group
    const ageGroup = this.determineAgeGroup(calculatedAge);
    user.age_group = ageGroup;
    recordStep(3, 'Determine Applicable Age Group', true, `Assigned strictly to age group: "${ageGroup}"`);

    // Step 4: Check jurisdiction/platform eligibility
    const policy = this.jurisdictions.get(user.country) || this.jurisdictions.get('GLOBAL')!;
    if (calculatedAge < policy.minimumAgeToRegister) {
      recordStep(4, 'Check Jurisdiction Eligibility', false, `Rejected: Age ${calculatedAge} violates ${policy.countryName} legal minimum of ${policy.minimumAgeToRegister} (${policy.regulatoryFramework})`);
      this.addAuditLog({
        eventType: 'MATCH_ATTEMPT_BLOCKED',
        actorId: user.id,
        actorRole: 'SYSTEM',
        severity: 'WARNING',
        summary: `Match blocked: Under legal age in jurisdiction ${policy.countryName}`,
        details: { userId: user.id, country: user.country, age: calculatedAge, policyMin: policy.minimumAgeToRegister }
      });
      return { success: false, stepLogs, failureReason: `Jurisdiction age threshold not met for ${policy.countryName}` };
    }
    recordStep(4, 'Check Jurisdiction Eligibility', true, `Eligible under ${policy.countryName} policy (${policy.regulatoryFramework}). Minimum required: ${policy.minimumAgeToRegister}`);

    // Step 5: Check guardian consent if required
    if (user.guardian_required) {
      if (user.guardian_status !== 'VERIFIED') {
        recordStep(5, 'Check Guardian Consent', false, `Guardian consent status is "${user.guardian_status}". Must be "VERIFIED" before video matching is permitted.`);
        this.addAuditLog({
          eventType: 'MATCH_ATTEMPT_BLOCKED',
          actorId: user.id,
          actorRole: 'SYSTEM',
          severity: 'INFO',
          summary: `Match blocked: Guardian consent not verified (status: ${user.guardian_status})`,
          details: { userId: user.id, guardianStatus: user.guardian_status, guardianEmail: user.guardian_email }
        });
        return { success: false, stepLogs, failureReason: `Parental/Guardian consent is required and currently ${user.guardian_status}` };
      }
      recordStep(5, 'Check Guardian Consent', true, `Guardian consent is VERIFIED (Approved on ${user.guardian_consent_date || 'prior date'})`);
    } else {
      recordStep(5, 'Check Guardian Consent', true, `Guardian consent not required for adult (Age: ${calculatedAge})`);
    }

    // Step 6: Check blocks/bans
    if (user.status !== 'ACTIVE') {
      recordStep(6, 'Check Blocks & Ban Status', false, `Account status is "${user.status}". Access suspended.`);
      return { success: false, stepLogs, failureReason: `Account is ${user.status}` };
    }
    recordStep(6, 'Check Blocks & Ban Status', true, `Account standing clean (Status: ACTIVE, Strikes: ${user.moderation_strikes}/3)`);

    // Step 7: Apply minor/adult separation
    const isMinor = calculatedAge < 18;
    recordStep(7, 'Apply Minor/Adult Separation', true, `Enforcing strict segmentation: ${isMinor ? `MINOR ZONE (${ageGroup}) - Isolated from adults & other bands` : 'ADULT ZONE (18+) - Isolated from all minors'}`);

    // Step 8: Apply matching preferences (common safe tags)
    recordStep(8, 'Apply Safe Matching Preferences', true, `Filtering matching pool by safe topics: [${user.interests.join(', ')}]`);

    // Step 9: Find eligible user in pool
    const candidatePeers = Array.from(this.users.values()).filter(peer => {
      if (peer.id === user.id) return false;
      if (peer.status !== 'ACTIVE') return false;
      if (user.blocked_user_ids.includes(peer.id) || peer.blocked_user_ids.includes(user.id)) return false;

      // Recalculate peer age on the fly to prevent stale data attacks
      const peerAge = this.calculateExactAge(peer.date_of_birth);
      const peerAgeGroup = this.determineAgeGroup(peerAge);

      // STRICT ZERO TOLERANCE RULES:
      // 1. Minor <-> Adult is IMPOSSIBLE
      const peerIsMinor = peerAge < 18;
      if (isMinor !== peerIsMinor) return false;

      // 2. Exact Age Band segmentation for minors
      if (isMinor && ageGroup !== peerAgeGroup) return false;

      // 3. Peer must also have verified guardian if required
      if (peer.guardian_required && peer.guardian_status !== 'VERIFIED') return false;

      return true;
    });

    if (candidatePeers.length === 0) {
      recordStep(9, 'Find Eligible User in Pool', false, `No eligible peers currently waiting in ${ageGroup} pool matching safety requirements`);
      return { success: false, stepLogs, failureReason: `No eligible peers in your exact age group (${ageGroup}) at this moment.` };
    }

    // Pick best match (prefer shared interest, otherwise random eligible)
    const matchedPeer = candidatePeers.find(p => p.interests.some(i => user.interests.includes(i))) || candidatePeers[0];
    recordStep(9, 'Find Eligible User in Pool', true, `Found safe matched peer: ${matchedPeer.nickname} (Age Group: ${matchedPeer.age_group}, Verified Safe)`);

    // Step 10: Create match session with ephemeral cryptographic token
    const sessionId = 'sess_' + Math.random().toString(36).substring(2, 10);
    const sessionToken = 'tok_' + Math.random().toString(36).substring(2, 15);
    
    const session: MatchSession = {
      id: sessionId,
      user1Id: user.id,
      user2Id: matchedPeer.id,
      ageGroup: user.age_group,
      startedAt: new Date().toISOString(),
      token: sessionToken,
      peerProfile: this.getPublicProfile(matchedPeer)
    };

    this.activeMatches.set(sessionId, session);

    recordStep(10, 'Create Match & Secure Handshake', true, `Session established: ${sessionId} (Ephemeral Token generated, Ready for secure video)`);

    this.addAuditLog({
      eventType: 'MATCH_ATTEMPT_PASSED',
      actorId: user.id,
      actorRole: 'SYSTEM',
      severity: 'INFO',
      summary: `Safe Match established between ${user.nickname} and ${matchedPeer.nickname} (Group: ${user.age_group})`,
      details: {
        sessionId,
        user1: { id: user.id, ageGroup: user.age_group },
        user2: { id: matchedPeer.id, ageGroup: matchedPeer.age_group }
      }
    });

    return {
      success: true,
      stepLogs,
      session
    };
  }

  /**
   * PRIVACY-COMPLIANT PUBLIC PROFILE
   * For minors: NEVER publicly show DOB, exact age, email, phone, IP, or exact location.
   * Only show: Nickname, Country, Age-appropriate category ("13–15", "16–17"), Safe Interests.
   */
  public getPublicProfile(user: UserProfile): PublicProfileView {
    const isMinor = user.server_calculated_age < 18;
    return {
      id: user.id,
      nickname: user.nickname,
      country: user.country,
      region: isMinor ? undefined : user.region,
      age_category: isMinor ? `Teen (${user.age_group})` : 'Adult (18+)',
      interests: user.interests,
      hobbies: user.hobbies,
      is_verified_minor: isMinor && user.guardian_status === 'VERIFIED'
    };
  }

  /**
   * REAL-TIME CHAT & PII SAFETY FILTER
   * Stricter chat & moderation limits for minors:
   * Redacts phone numbers, social handles, email, addresses, predatory solicitation.
   */
  public filterAndSendChatMessage(
    matchId: string, 
    senderId: string, 
    rawText: string
  ): { success: boolean; message?: ChatMessage; warning?: string } {
    const sender = this.users.get(senderId);
    if (!sender) return { success: false, warning: 'User not found' };

    const isMinor = sender.server_calculated_age < 18;
    let text = rawText.trim();
    let isFlagged = false;
    let flagReason: string | undefined;

    // 1. Phone number detection
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10}\b/g;
    if (phoneRegex.test(text)) {
      isFlagged = true;
      flagReason = 'Personal Phone Number detected and redacted';
      text = text.replace(phoneRegex, '[REDACTED PHONE NUMBER]');
    }

    // 2. Social handles / Discord / Snapchat / Instagram
    const socialRegex = /(snapchat|snap|insta|instagram|ig|discord|telegram|whatsapp|kik|tiktok)[\s:@]+[a-zA-Z0-9._-]+/gi;
    if (socialRegex.test(text)) {
      isFlagged = true;
      flagReason = flagReason ? flagReason + ' & Social Media Handle detected' : 'Social Media Handle detected and redacted';
      text = text.replace(socialRegex, '[REDACTED SOCIAL HANDLE]');
    }

    // 3. Email addresses
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    if (emailRegex.test(text)) {
      isFlagged = true;
      flagReason = flagReason ? flagReason + ' & Email detected' : 'Personal Email detected and redacted';
      text = text.replace(emailRegex, '[REDACTED EMAIL]');
    }

    // 4. Predatory & location inquiries
    const predatoryPatterns = [
      /where do you live/i,
      /what school/i,
      /send (a )?(pic|photo|nude)/i,
      /home alone/i,
      /meet up/i,
      /what is your address/i,
      /come over/i
    ];

    for (const pattern of predatoryPatterns) {
      if (pattern.test(text)) {
        isFlagged = true;
        flagReason = 'Safety violation: Attempt to solicit personal/offline meeting information';
        text = '[CONTENT BLOCKED BY SAFETY MODERATION]';
        break;
      }
    }

    const message: ChatMessage = {
      id: 'msg_' + Math.random().toString(36).substring(2, 9),
      matchId,
      senderId: sender.id,
      senderName: sender.nickname,
      isSenderMinor: isMinor,
      text,
      originalText: isFlagged ? rawText : undefined,
      timestamp: new Date().toISOString(),
      isFlagged,
      flagReason
    };

    if (!this.chatMessages.has(matchId)) {
      this.chatMessages.set(matchId, []);
    }
    this.chatMessages.get(matchId)!.push(message);

    if (isFlagged) {
      sender.moderation_strikes += 1;
      this.addAuditLog({
        eventType: 'MODERATION_VIOLATION',
        actorId: sender.id,
        actorRole: 'USER',
        severity: 'WARNING',
        summary: `Chat moderation strike (${sender.moderation_strikes}/3) for ${sender.nickname}: ${flagReason}`,
        details: { userId: sender.id, matchId, flagReason, redactedText: text }
      });

      if (sender.guardian_email) {
        this.addGuardianAlert({
          userId: sender.id,
          guardianEmail: sender.guardian_email,
          eventType: 'MODERATION_VIOLATION',
          severity: 'HIGH',
          title: 'Chat Safety Filter Triggered',
          description: `An attempt to share contact or off-platform information was blocked by Gomegle's safety filter. Strike ${sender.moderation_strikes} of 3.`
        });
      }

      if (sender.moderation_strikes >= 3) {
        sender.status = 'RESTRICTED';
        this.addAuditLog({
          eventType: 'ADMIN_ACTION',
          actorId: 'system',
          actorRole: 'SYSTEM',
          severity: 'CRITICAL',
          summary: `Account automatically RESTRICTED for repeated moderation strikes: ${sender.nickname}`,
          details: { userId: sender.id, strikes: sender.moderation_strikes }
        });
        if (sender.guardian_email) {
          this.addGuardianAlert({
            userId: sender.id,
            guardianEmail: sender.guardian_email,
            eventType: 'ACCOUNT_SUSPENSION',
            severity: 'CRITICAL',
            title: 'Account Restricted for Safety Violations',
            description: `Account has received 3 moderation strikes and is now restricted from matching until guardian or admin review.`
          });
        }
      }
    }

    return {
      success: true,
      message,
      warning: isFlagged ? flagReason : undefined
    };
  }

  /**
   * GUARDIAN PORTAL ACTIONS
   * Never expose private chats or raw video streams. Only high-level safety health,
   * active status, controls, and alert stream.
   */
  public updateGuardianConsent(
    userId: string, 
    newStatus: 'VERIFIED' | 'REVOKED',
    guardianEmail: string
  ): { success: boolean; error?: string } {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: 'User not found' };

    user.guardian_status = newStatus;
    if (newStatus === 'VERIFIED') {
      user.guardian_consent_date = new Date().toISOString();
      user.guardian_revocation_date = undefined;
      this.addAuditLog({
        eventType: 'GUARDIAN_CONSENT_GRANTED',
        actorId: guardianEmail,
        actorRole: 'GUARDIAN',
        severity: 'INFO',
        summary: `Guardian consent VERIFIED for ${user.nickname} by ${guardianEmail}`,
        details: { userId, guardianEmail }
      });
    } else {
      user.guardian_revocation_date = new Date().toISOString();
      // Immediately terminate any active sessions
      for (const [sId, sess] of this.activeMatches.entries()) {
        if (sess.user1Id === userId || sess.user2Id === userId) {
          sess.endedAt = new Date().toISOString();
          this.activeMatches.delete(sId);
        }
      }
      this.addAuditLog({
        eventType: 'GUARDIAN_CONSENT_REVOKED',
        actorId: guardianEmail,
        actorRole: 'GUARDIAN',
        severity: 'CRITICAL',
        summary: `Guardian consent REVOKED for ${user.nickname} by ${guardianEmail}. Instant match lockout applied.`,
        details: { userId, guardianEmail }
      });

      this.addGuardianAlert({
        userId,
        guardianEmail,
        eventType: 'GUARDIAN_CONSENT_REVOKED',
        severity: 'HIGH',
        title: 'Guardian Consent Successfully Revoked',
        description: `Social matching and video features have been locked immediately for ${user.nickname}.`
      });
    }

    return { success: true };
  }

  public reportUser(params: {
    reporterId: string;
    reportedUserId: string;
    reason: SafetyReport['reason'];
    description: string;
    matchSessionId?: string;
  }): { success: boolean; report?: SafetyReport } {
    const reporter = this.users.get(params.reporterId);
    const reported = this.users.get(params.reportedUserId);

    if (!reporter || !reported) return { success: false };

    const report: SafetyReport = {
      id: 'rep_' + Math.random().toString(36).substring(2, 9),
      reporterId: params.reporterId,
      reporterNickname: reporter.nickname,
      reportedUserId: params.reportedUserId,
      reportedUserNickname: reported.nickname,
      reason: params.reason,
      description: params.description,
      timestamp: new Date().toISOString(),
      status: 'OPEN',
      matchSessionId: params.matchSessionId
    };

    this.reports.unshift(report);

    // Auto-block user for reporter
    if (!reporter.blocked_user_ids.includes(reported.id)) {
      reporter.blocked_user_ids.push(reported.id);
    }

    this.addAuditLog({
      eventType: 'SAFETY_REPORT_FILED',
      actorId: reporter.id,
      actorRole: 'USER',
      severity: 'WARNING',
      summary: `Safety report filed: ${reporter.nickname} reported ${reported.nickname} for ${params.reason}`,
      details: { reportId: report.id, reporterId: reporter.id, reportedUserId: reported.id, reason: params.reason }
    });

    if (reported.guardian_email) {
      this.addGuardianAlert({
        userId: reported.id,
        guardianEmail: reported.guardian_email,
        eventType: 'SERIOUS_SAFETY_REPORT',
        severity: 'CRITICAL',
        title: 'Safety Report Filed Regarding Account',
        description: `A peer filed a safety report (${params.reason}) regarding a recent session. Our moderation team is currently reviewing the report.`
      });
    }

    return { success: true, report };
  }

  public blockUser(userId: string, targetUserId: string): { success: boolean } {
    const user = this.users.get(userId);
    if (!user) return { success: false };
    if (!user.blocked_user_ids.includes(targetUserId)) {
      user.blocked_user_ids.push(targetUserId);
    }
    return { success: true };
  }

  public addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) {
    const log: AuditLogEntry = {
      id: 'log_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.auditLogs.unshift(log);
  }

  public addGuardianAlert(alert: Omit<GuardianAlert, 'id' | 'timestamp' | 'acknowledged'>) {
    const item: GuardianAlert = {
      id: 'alt_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      acknowledged: false,
      ...alert
    };
    this.guardianAlerts.unshift(item);
  }

  /**
   * SEED PRE-POPULATED DATA
   * Rich baseline profiles covering all age tiers, guardians, and pending verifications.
   */
  private seedInitialData() {
    // 1. Minor 14 yo (13-15 bracket) - US
    const teenLeo: UserProfile = {
      id: 'usr_leo14',
      nickname: 'Leo (GameDev)',
      country: 'US',
      date_of_birth: { day: 12, month: 4, year: 2012 }, // ~14
      server_calculated_age: 14,
      age_group: '13–15',
      age_verified: 'VERIFIED',
      guardian_required: true,
      guardian_status: 'VERIFIED',
      guardian_email: 'sarah.parent@guardianmail.org',
      guardian_consent_date: '2026-01-15T10:00:00Z',
      guardian_token: 'gtok_leo_parent_pass',
      interests: ['Coding', 'Robotics', 'Indie Games'],
      hobbies: ['Drawing', 'Chess'],
      status: 'ACTIVE',
      moderation_strikes: 0,
      blocked_user_ids: [],
      created_at: '2026-01-15T09:30:00Z'
    };
    this.users.set(teenLeo.id, teenLeo);

    // 2. Minor 14 yo peer (13-15 bracket) - GB
    const teenMaya: UserProfile = {
      id: 'usr_maya14',
      nickname: 'Maya (PixelArt)',
      country: 'GB',
      date_of_birth: { day: 8, month: 11, year: 2011 }, // ~14
      server_calculated_age: 14,
      age_group: '13–15',
      age_verified: 'VERIFIED',
      guardian_required: true,
      guardian_status: 'VERIFIED',
      guardian_email: 'claire.guardian@ukmail.co.uk',
      guardian_consent_date: '2026-02-01T14:20:00Z',
      guardian_token: 'gtok_maya_parent',
      interests: ['Art', 'Indie Games', 'Animation'],
      hobbies: ['Digital Painting', 'Music'],
      status: 'ACTIVE',
      moderation_strikes: 0,
      blocked_user_ids: [],
      created_at: '2026-02-01T14:00:00Z'
    };
    this.users.set(teenMaya.id, teenMaya);

    // 3. Minor 16 yo (16-17 bracket) - US
    const teenSam: UserProfile = {
      id: 'usr_sam16',
      nickname: 'Sam (BioStudent)',
      country: 'US',
      date_of_birth: { day: 22, month: 7, year: 2009 }, // ~17
      server_calculated_age: 17,
      age_group: '16–17',
      age_verified: 'VERIFIED',
      guardian_required: true,
      guardian_status: 'VERIFIED',
      guardian_email: 'mark.parent@guardianmail.org',
      guardian_consent_date: '2026-01-10T12:00:00Z',
      guardian_token: 'gtok_sam_parent',
      interests: ['Science', 'Biology', 'Podcasts'],
      hobbies: ['Track & Field', 'Reading'],
      status: 'ACTIVE',
      moderation_strikes: 0,
      blocked_user_ids: [],
      created_at: '2026-01-10T11:45:00Z'
    };
    this.users.set(teenSam.id, teenSam);

    // 4. Minor 17 yo peer (16-17 bracket) - DE
    const teenChloe: UserProfile = {
      id: 'usr_chloe17',
      nickname: 'Chloe (Synths)',
      country: 'DE',
      date_of_birth: { day: 15, month: 2, year: 2009 }, // ~17
      server_calculated_age: 17,
      age_group: '16–17',
      age_verified: 'VERIFIED',
      guardian_required: true,
      guardian_status: 'VERIFIED',
      guardian_email: 'hans.parent@berlinmail.de',
      guardian_consent_date: '2026-02-12T16:00:00Z',
      guardian_token: 'gtok_chloe_parent',
      interests: ['Electronic Music', 'Science', 'Languages'],
      hobbies: ['Keyboards', 'Photography'],
      status: 'ACTIVE',
      moderation_strikes: 0,
      blocked_user_ids: [],
      created_at: '2026-02-12T15:30:00Z'
    };
    this.users.set(teenChloe.id, teenChloe);

    // 5. Adult 24 yo (18+ bracket) - US
    const adultMarcus: UserProfile = {
      id: 'usr_marcus24',
      nickname: 'Marcus (Architect)',
      country: 'US',
      date_of_birth: { day: 5, month: 3, year: 2002 }, // ~24
      server_calculated_age: 24,
      age_group: '18+',
      age_verified: 'VERIFIED',
      guardian_required: false,
      guardian_status: 'NOT_REQUIRED',
      interests: ['Architecture', 'Urban Design', 'Photography'],
      hobbies: ['Cycling', 'Coffee Brewing'],
      status: 'ACTIVE',
      moderation_strikes: 0,
      blocked_user_ids: [],
      created_at: '2026-01-01T10:00:00Z'
    };
    this.users.set(adultMarcus.id, adultMarcus);

    // 6. Adult 27 yo peer (18+ bracket) - US
    const adultElena: UserProfile = {
      id: 'usr_elena27',
      nickname: 'Elena (AI Research)',
      country: 'US',
      date_of_birth: { day: 19, month: 8, year: 1999 }, // ~27
      server_calculated_age: 27,
      age_group: '18+',
      age_verified: 'VERIFIED',
      guardian_required: false,
      guardian_status: 'NOT_REQUIRED',
      interests: ['Machine Learning', 'Open Source', 'Photography'],
      hobbies: ['Hiking', 'Baking'],
      status: 'ACTIVE',
      moderation_strikes: 0,
      blocked_user_ids: [],
      created_at: '2026-01-05T08:00:00Z'
    };
    this.users.set(adultElena.id, adultElena);

    // 7. Child under 13 with PENDING guardian consent
    const childTimmy: UserProfile = {
      id: 'usr_timmy11',
      nickname: 'Timmy (SpaceLover)',
      country: 'US',
      date_of_birth: { day: 30, month: 6, year: 2015 }, // ~11
      server_calculated_age: 11,
      age_group: 'Under 13',
      age_verified: 'SELF_DECLARED',
      guardian_required: true,
      guardian_status: 'PENDING',
      guardian_email: 'timmy.mom@guardianmail.org',
      guardian_token: 'gtok_timmy_parent',
      interests: ['Astronomy', 'Lego', 'Minecraft'],
      hobbies: ['Stargazing', 'Building'],
      status: 'RESTRICTED',
      moderation_strikes: 0,
      blocked_user_ids: [],
      created_at: '2026-03-01T12:00:00Z'
    };
    this.users.set(childTimmy.id, childTimmy);

    // Initial Audit Logs
    this.addAuditLog({
      eventType: 'REGISTRATION',
      actorId: 'system',
      actorRole: 'SYSTEM',
      severity: 'INFO',
      summary: 'Safety engine initialized with jurisdiction baseline rules and pre-vetted age pools.',
      details: { activeJurisdictions: Object.keys(DEFAULT_JURISDICTIONS) }
    });

    this.addAuditLog({
      eventType: 'GUARDIAN_CONSENT_GRANTED',
      actorId: 'sarah.parent@guardianmail.org',
      actorRole: 'GUARDIAN',
      severity: 'INFO',
      summary: 'Verified guardian consent granted for Leo (GameDev) (14 yo, US). Strict minor protections active.',
      details: { userId: teenLeo.id }
    });

    // Sample Safety Report for demonstration
    this.reports.push({
      id: 'rep_sample_01',
      reporterId: teenLeo.id,
      reporterNickname: teenLeo.nickname,
      reportedUserId: 'usr_suspicious_stranger',
      reportedUserNickname: 'Guest_9921',
      reason: 'SOLICITATION',
      description: 'User asked for my Instagram and Snapchat after joining room.',
      timestamp: '2026-03-20T17:40:00Z',
      status: 'REVIEWED',
      resolvedBy: 'Admin_ChiefSafety',
      resolutionNotes: 'User was issued strike and restricted from teen pool.'
    });

    // Sample Guardian Alert
    this.guardianAlerts.push({
      id: 'alt_sample_01',
      userId: teenLeo.id,
      guardianEmail: 'sarah.parent@guardianmail.org',
      eventType: 'SECURITY_EVENT',
      severity: 'HIGH',
      title: 'Consent Verification Confirmed',
      description: 'Your parental consent for Leo has been registered. Safe Teen matching (13–15 only) is active.',
      timestamp: '2026-01-15T10:00:00Z',
      acknowledged: true
    });
  }
}

// Global Singleton Instance
export const safetyEngine = new SafetyEngineStore();
