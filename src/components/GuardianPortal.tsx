import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Bell,
  Clock,
  Lock,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  EyeOff,
  Settings,
  Shield
} from 'lucide-react';
import { UserProfile, GuardianAlert } from '../types/safety';
import { safetyEngine } from '../server/safetyEngine';
import avatarGuardianPath from '../assets/images/avatar_guardian_1790243911935.jpg';

interface GuardianPortalProps {
  currentUser: UserProfile;
  onRefreshUser: (updatedUser: UserProfile) => void;
}

export const GuardianPortal: React.FC<GuardianPortalProps> = ({
  currentUser,
  onRefreshUser
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'alerts' | 'privacy'>('overview');
  const [strictFiltering, setStrictFiltering] = useState(true);
  const [discoveryAllowed, setDiscoveryAllowed] = useState(false);
  const [curfewHours, setCurfewHours] = useState('21:00 - 08:00');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const isMinor = currentUser.server_calculated_age < 18;
  const isConsentActive = currentUser.guardian_status === 'VERIFIED';
  const guardianEmail = currentUser.guardian_email || 'guardian@familyprotect.org';

  const alerts = safetyEngine.guardianAlerts.filter(
    (a) => a.userId === currentUser.id || a.guardianEmail === currentUser.guardian_email
  );

  const handleToggleConsent = (approve: boolean) => {
    const newStatus = approve ? 'VERIFIED' : 'REVOKED';
    safetyEngine.updateGuardianConsent(currentUser.id, newStatus, guardianEmail);
    
    // Refresh user state
    const refreshed = safetyEngine.users.get(currentUser.id);
    if (refreshed) {
      onRefreshUser({ ...refreshed });
    }

    setActionSuccess(
      approve
        ? 'Parental Consent Granted. Safe Teen matching unlocked.'
        : 'Consent Revoked. Matching features immediately locked for this account.'
    );
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const handleExportData = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      accountHolder: currentUser.nickname,
      jurisdiction: currentUser.country,
      guardianStatus: currentUser.guardian_status,
      guardianConsentDate: currentUser.guardian_consent_date,
      serverCalculatedAge: currentUser.server_calculated_age,
      auditRecordsCount: safetyEngine.auditLogs.filter(a => a.actorId === currentUser.id).length,
      complianceStandard: 'COPPA & GDPR Article 15 Data Portability'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gomegle_guardian_export_${currentUser.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = () => {
    safetyEngine.users.delete(currentUser.id);
    safetyEngine.addAuditLog({
      eventType: 'ADMIN_ACTION',
      actorId: guardianEmail,
      actorRole: 'GUARDIAN',
      severity: 'CRITICAL',
      summary: `Guardian requested full GDPR/COPPA erasure for account: ${currentUser.nickname} (${currentUser.id})`,
      details: { guardianEmail }
    });
    setShowDeleteConfirm(false);
    setActionSuccess('Account marked for deletion. All identifiers permanently expunged.');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Portal Header with Guardian Verification Badge */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-4">
          <img
            src={avatarGuardianPath}
            alt="Parent Guardian"
            referrerPolicy="no-referrer"
            className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500/40 shrink-0"
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-white tracking-tight">
                Guardian Safety Dashboard
              </h1>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-indigo-400 font-mono">/guardian</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Supervising: <strong className="text-slate-200">{currentUser.nickname}</strong> ({currentUser.age_group} · {currentUser.country}) · Guardian Email: <span className="font-mono text-slate-300">{guardianEmail}</span>
            </p>
          </div>
        </div>

        {/* Consent Status Quick Action */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
          {isConsentActive ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Consent Active
              </span>
              <button
                onClick={() => handleToggleConsent(false)}
                className="px-3 py-1.5 text-xs font-semibold text-red-300 hover:text-white bg-red-950/80 hover:bg-red-900/90 border border-red-800/60 rounded-lg transition-colors"
                title="Revoke consent and lock minor account immediately"
              >
                Revoke Consent
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Consent {currentUser.guardian_status}
              </span>
              <button
                onClick={() => handleToggleConsent(true)}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-xs"
              >
                Verify & Grant Consent
              </button>
            </div>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Segmented Control Tabs (Functional buttons according to frontend constitution) */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'overview'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Safety Overview
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'settings'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Minor Safety Controls
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === 'alerts'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Safety Alerts</span>
          {alerts.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-mono flex items-center justify-center">
              {alerts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('privacy')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'privacy'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Zero-Surveillance & Privacy
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Health Card 1 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Account Safety Standing</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-white capitalize">
                {currentUser.status}
              </div>
              <p className="text-[11px] text-slate-400">
                Moderation Strikes: <span className="font-mono text-indigo-400">{currentUser.moderation_strikes} / 3</span>
              </p>
            </div>

            {/* Health Card 2 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Age Band Segmentation</span>
                <Lock className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-xl font-bold text-white">
                {currentUser.age_group} Pool Only
              </div>
              <p className="text-[11px] text-slate-400">
                Adults (18+) mathematically barred from this pool
              </p>
            </div>

            {/* Health Card 3 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Guardian Consent</span>
                <UserCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-white">
                {currentUser.guardian_status}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Verified: {currentUser.guardian_consent_date ? new Date(currentUser.guardian_consent_date).toLocaleDateString() : 'Pending'}
              </p>
            </div>

          </div>

          {/* High-Level Safety Details */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              Platform Safeguards Applied to This Minor
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 space-y-1">
                <span className="font-semibold text-slate-200">1. Complete Minor ↔ Adult Quarantine</span>
                <p className="text-slate-400 text-[11px]">
                  Server-side rules prevent any adult user from discovering, matching with, or viewing this minor's session.
                </p>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 space-y-1">
                <span className="font-semibold text-slate-200">2. Real-Time PII & Predator Shield</span>
                <p className="text-slate-400 text-[11px]">
                  All outgoing and incoming messages are filtered for phone numbers, Instagram, Snapchat, Discord handles, and address solicitations.
                </p>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 space-y-1">
                <span className="font-semibold text-slate-200">3. Anti-Bypass DOB Lock</span>
                <p className="text-slate-400 text-[11px]">
                  The user cannot alter their birth date to access adult tiers. Any change triggers manual verification and alerts this guardian dashboard.
                </p>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 space-y-1">
                <span className="font-semibold text-slate-200">4. Immediate Kill Switch</span>
                <p className="text-slate-400 text-[11px]">
                  Revoking consent instantly disconnects any active video match and places the account in restricted standby.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Settings */}
      {activeTab === 'settings' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-white">Minor Protection Controls</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Customize protection layers for {currentUser.nickname}. Changes apply immediately.
            </p>
          </div>

          <div className="space-y-4">
            {/* Toggle 1: Strict Chat Filter */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
              <div>
                <span className="text-xs font-semibold text-slate-200 block">
                  Strict Automated AI Content & PII Filter
                </span>
                <span className="text-[11px] text-slate-400">
                  Blocks phone numbers, social media handles, email addresses, and suspicious off-platform contact requests.
                </span>
              </div>
              <button
                onClick={() => setStrictFiltering(!strictFiltering)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  strictFiltering ? 'bg-indigo-600 justify-end' : 'bg-slate-800 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-xs"></div>
              </button>
            </div>

            {/* Toggle 2: Discovery Mode */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
              <div>
                <span className="text-xs font-semibold text-slate-200 block">
                  Public Discovery & Search Visibility
                </span>
                <span className="text-[11px] text-slate-400">
                  Recommended OFF for minors: Disables public searchability and allows matching only through peer random matching.
                </span>
              </div>
              <button
                onClick={() => setDiscoveryAllowed(!discoveryAllowed)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  discoveryAllowed ? 'bg-indigo-600 justify-end' : 'bg-slate-800 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-xs"></div>
              </button>
            </div>

            {/* Curfew Hours */}
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">
                  Nighttime Matching Curfew
                </span>
                <Clock className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-[11px] text-slate-400">
                Locks video matching features during overnight hours to prevent late-night unsupervised usage.
              </p>
              <select
                value={curfewHours}
                onChange={(e) => setCurfewHours(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200"
              >
                <option value="21:00 - 08:00">21:00 to 08:00 (Recommended)</option>
                <option value="22:00 - 07:00">22:00 to 07:00</option>
                <option value="20:00 - 09:00">20:00 to 09:00 (Strict)</option>
                <option value="none">No Curfew</option>
              </select>
            </div>

            {/* Blocked Users Count */}
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-slate-200">Blocked Peer Accounts</span>
                <p className="text-[11px] text-slate-400">
                  Total peers blocked by minor: <span className="font-mono text-white">{currentUser.blocked_user_ids.length}</span>
                </p>
              </div>
              <span className="text-[11px] text-slate-400">Automatic exclusion applied</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Alerts */}
      {activeTab === 'alerts' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Safety Event Alerts</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Notifications for serious events: suspensions, safety reports, DOB change attempts.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Total: {alerts.length}
            </span>
          </div>

          <div className="space-y-2.5">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No safety alerts logged for this account.
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg flex items-start gap-3 text-xs"
                >
                  <div className="p-1.5 rounded-md bg-red-950/80 text-red-400 shrink-0 mt-0.5">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{alert.title}</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(alert.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] mt-1">{alert.description}</p>
                    <div className="mt-2 text-[10px] text-indigo-400 font-mono">
                      Event: {alert.eventType} · Severity: {alert.severity}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Privacy & Zero Surveillance Policy */}
      {activeTab === 'privacy' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="p-4 bg-indigo-950/30 border border-indigo-900/50 rounded-lg flex items-start gap-3">
            <EyeOff className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <h4 className="font-semibold text-white">The Zero-Surveillance Guarantee</h4>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Per international child rights and platform design standards, the Guardian Dashboard <strong>does NOT wiretap, record, or expose private live video streams or text transcripts</strong> to parents. We respect youth privacy while safeguarding them through automated server-side threat detection, age segmentation, and serious incident alerting.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider text-slate-400">
              Legal Compliance & Data Portability (COPPA / GDPR)
            </h4>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleExportData}
                className="px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-700/60"
              >
                <Download className="w-3.5 h-3.5" />
                Export Account Safety Data (JSON)
              </button>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-2 text-xs font-medium bg-red-950/80 hover:bg-red-900 text-red-200 rounded-lg flex items-center gap-1.5 transition-colors border border-red-800/60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Request Permanent Account Erasure
              </button>
            </div>

            {showDeleteConfirm && (
              <div className="p-3 bg-red-950/60 border border-red-900 rounded-lg text-xs text-red-200 space-y-2">
                <p className="font-semibold">Confirm Full Account Deletion?</p>
                <p className="text-[11px] text-red-300/90">
                  This action will irrevocably delete {currentUser.nickname}'s profile, guardian linkages, and stored metadata in accordance with COPPA & GDPR Right to Erasure.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleDeleteAccount}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold"
                  >
                    Confirm Permanent Erasure
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1 bg-slate-800 text-slate-300 rounded text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
