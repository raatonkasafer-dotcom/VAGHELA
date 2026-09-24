import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  FileText,
  AlertTriangle,
  Globe,
  Lock,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  UserX,
  Filter
} from 'lucide-react';
import {
  UserProfile,
  SafetyReport,
  AuditLogEntry,
  JurisdictionPolicy
} from '../types/safety';
import { safetyEngine } from '../server/safetyEngine';

interface AdminConsoleProps {
  onRefreshData: () => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({ onRefreshData }) => {
  const [activeTab, setActiveTab] = useState<'reports' | 'verifications' | 'audit_logs' | 'jurisdictions'>('reports');
  const [reportFilter, setReportFilter] = useState<'ALL' | 'OPEN' | 'REVIEWED'>('OPEN');
  const [auditFilter, setAuditFilter] = useState<string>('ALL');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const users = Array.from(safetyEngine.users.values());
  const reports = safetyEngine.reports;
  const auditLogs = safetyEngine.auditLogs;
  const jurisdictions = Array.from(safetyEngine.jurisdictions.values());

  const filteredReports = reports.filter((r) => {
    if (reportFilter === 'ALL') return true;
    return r.status === reportFilter;
  });

  const filteredAuditLogs = auditLogs.filter((log) => {
    if (auditFilter === 'ALL') return true;
    return log.eventType === auditFilter;
  });

  const handleResolveReport = (reportId: string, action: 'WARN' | 'RESTRICT' | 'DISMISS') => {
    const report = reports.find((r) => r.id === reportId);
    if (!report) return;

    report.status = action === 'DISMISS' ? 'DISMISSED' : 'ACTION_TAKEN';
    report.resolvedBy = 'Admin_ComplianceChief';
    report.resolutionNotes = `Admin executed action: ${action}`;

    const reportedUser = safetyEngine.users.get(report.reportedUserId);
    if (reportedUser && action !== 'DISMISS') {
      if (action === 'RESTRICT') {
        reportedUser.status = 'RESTRICTED';
      }
      reportedUser.moderation_strikes += 1;
    }

    safetyEngine.addAuditLog({
      eventType: 'ADMIN_ACTION',
      actorId: 'Admin_ComplianceChief',
      actorRole: 'ADMIN',
      severity: 'WARNING',
      summary: `Admin resolved report ${reportId} against ${report.reportedUserNickname} with action: ${action}`,
      details: { reportId, action, reportedUserId: report.reportedUserId }
    });

    onRefreshData();
    setActionNotice(`Report ${reportId} processed: Action "${action}" logged in immutable audit records.`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleSetVerificationStatus = (
    userId: string,
    newStatus: 'VERIFIED' | 'REQUIRES_REVIEW' | 'SELF_DECLARED'
  ) => {
    const user = safetyEngine.users.get(userId);
    if (!user) return;

    const oldStatus = user.age_verified;
    user.age_verified = newStatus;

    safetyEngine.addAuditLog({
      eventType: 'VERIFICATION_STATUS_CHANGED',
      actorId: 'Admin_ComplianceChief',
      actorRole: 'ADMIN',
      severity: newStatus === 'VERIFIED' ? 'INFO' : 'WARNING',
      summary: `Admin updated age verification status for ${user.nickname} from ${oldStatus} to ${newStatus}`,
      details: { userId, oldStatus, newStatus }
    });

    onRefreshData();
    setActionNotice(`Verification status for ${user.nickname} changed to ${newStatus}. Logged in audit registry.`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Console Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h1 className="text-lg font-bold text-white tracking-tight">
              Safety, Age Verification & Compliance Console
            </h1>
            <span className="text-xs font-mono text-slate-400">· /admin</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative regulatory management, minor safety reports triage, and immutable tamper-evident audit logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-slate-300">
            Open Reports: <span className="text-red-400 font-bold">{reports.filter(r => r.status === 'OPEN').length}</span> · Total Users: <span className="text-indigo-400 font-bold">{users.length}</span>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-indigo-950/70 border border-indigo-800/80 rounded-lg text-xs text-indigo-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Segmented Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === 'reports' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          Safety Reports ({reports.length})
        </button>

        <button
          onClick={() => setActiveTab('verifications')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === 'verifications' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
          Age Verification Queue
        </button>

        <button
          onClick={() => setActiveTab('audit_logs')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === 'audit_logs' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          Safety Audit Logs ({auditLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('jurisdictions')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === 'jurisdictions' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-indigo-400" />
          Jurisdiction Policies
        </button>
      </div>

      {/* TAB 1: SAFETY REPORTS */}
      {activeTab === 'reports' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white">Minor Safety & Misconduct Reports</h3>
              <p className="text-xs text-slate-400">Incident reports filed during matches and video sessions.</p>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Status:
              </span>
              {(['ALL', 'OPEN', 'REVIEWED'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setReportFilter(filter)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    reportFilter === filter ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredReports.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No reports matching current filter criteria.
              </div>
            ) : (
              filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-950/80 text-red-300 border border-red-800">
                          {report.reason}
                        </span>
                        <span className="font-semibold text-white">
                          Reported: {report.reportedUserNickname} ({report.reportedUserId})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Filed by: <strong className="text-slate-300">{report.reporterNickname}</strong> · {new Date(report.timestamp).toLocaleString()}
                      </p>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      report.status === 'OPEN' ? 'bg-amber-950 text-amber-300' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {report.status}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800/80 text-slate-300 text-[11px]">
                    "{report.description}"
                  </div>

                  {report.status === 'OPEN' && (
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80">
                      <button
                        onClick={() => handleResolveReport(report.id, 'DISMISS')}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                      >
                        Dismiss (No Violation)
                      </button>
                      <button
                        onClick={() => handleResolveReport(report.id, 'WARN')}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium"
                      >
                        Issue Warning (+1 Strike)
                      </button>
                      <button
                        onClick={() => handleResolveReport(report.id, 'RESTRICT')}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold"
                      >
                        Restrict Account
                      </button>
                    </div>
                  )}

                  {report.status !== 'OPEN' && (
                    <div className="text-[10px] text-slate-400 font-mono">
                      Resolved by: {report.resolvedBy} · Notes: {report.resolutionNotes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AGE VERIFICATION REVIEW QUEUE */}
      {activeTab === 'verifications' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Age Verification & Identity Tiers</h3>
            <p className="text-xs text-slate-400">
              Users can be UNVERIFIED, SELF_DECLARED, VERIFIED, or marked REQUIRES_REVIEW (e.g. after DOB edit).
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[11px] text-slate-400 border-b border-slate-800 bg-slate-950/60 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Jurisdiction</th>
                  <th className="py-2.5 px-3">Server DOB</th>
                  <th className="py-2.5 px-3">Calculated Age</th>
                  <th className="py-2.5 px-3">Age Group</th>
                  <th className="py-2.5 px-3">Guardian Status</th>
                  <th className="py-2.5 px-3">Verification Tier</th>
                  <th className="py-2.5 px-3 text-right">Admin Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-850/60">
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {u.nickname}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-mono">
                      {u.country}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {u.date_of_birth.year}-{u.date_of_birth.month}-{u.date_of_birth.day}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-400">
                      {u.server_calculated_age}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-slate-300 font-medium">{u.age_group}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        u.guardian_status === 'VERIFIED'
                          ? 'bg-emerald-950 text-emerald-300'
                          : u.guardian_status === 'PENDING'
                          ? 'bg-amber-950 text-amber-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {u.guardian_status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        u.age_verified === 'VERIFIED'
                          ? 'bg-emerald-950 text-emerald-300'
                          : u.age_verified === 'REQUIRES_REVIEW'
                          ? 'bg-red-950 text-red-300 font-bold'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {u.age_verified}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                      {u.age_verified !== 'VERIFIED' && (
                        <button
                          onClick={() => handleSetVerificationStatus(u.id, 'VERIFIED')}
                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-semibold"
                        >
                          Approve Verified
                        </button>
                      )}
                      {u.age_verified === 'VERIFIED' && (
                        <button
                          onClick={() => handleSetVerificationStatus(u.id, 'REQUIRES_REVIEW')}
                          className="px-2 py-0.5 bg-amber-700 hover:bg-amber-600 text-white rounded text-[10px]"
                        >
                          Flag For Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SAFETY AUDIT LOGS */}
      {activeTab === 'audit_logs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white">Immutable Safety Audit Trail</h3>
              <p className="text-xs text-slate-400">
                Every registration, DOB modification, blocked adult-minor match attempt, and admin action is recorded with cryptographic timestamps.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="audit-filter" className="text-slate-400">Event Filter:</label>
              <select
                id="audit-filter"
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200"
              >
                <option value="ALL">All Events</option>
                <option value="REGISTRATION">REGISTRATION</option>
                <option value="DOB_MODIFICATION_ATTEMPT">DOB_MODIFICATION_ATTEMPT</option>
                <option value="MATCH_ATTEMPT_PASSED">MATCH_ATTEMPT_PASSED</option>
                <option value="MATCH_ATTEMPT_BLOCKED">MATCH_ATTEMPT_BLOCKED</option>
                <option value="GUARDIAN_CONSENT_GRANTED">GUARDIAN_CONSENT_GRANTED</option>
                <option value="GUARDIAN_CONSENT_REVOKED">GUARDIAN_CONSENT_REVOKED</option>
                <option value="SAFETY_REPORT_FILED">SAFETY_REPORT_FILED</option>
                <option value="MODERATION_VIOLATION">MODERATION_VIOLATION</option>
                <option value="ADMIN_ACTION">ADMIN_ACTION</option>
                <option value="VERIFICATION_STATUS_CHANGED">VERIFICATION_STATUS_CHANGED</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            {filteredAuditLogs.map((log) => {
              const isCrit = log.severity === 'CRITICAL';
              const isWarn = log.severity === 'WARNING';

              return (
                <div
                  key={log.id}
                  className={`p-3 rounded-lg border text-xs flex items-start gap-3 ${
                    isCrit
                      ? 'bg-red-950/30 border-red-900/60'
                      : isWarn
                      ? 'bg-amber-950/20 border-amber-900/40'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {isCrit ? (
                      <XCircle className="w-4 h-4 text-red-400" />
                    ) : isWarn ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-semibold">
                          {log.eventType}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          Actor: <strong className="text-slate-200">{log.actorRole}</strong> ({log.actorId})
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-slate-200 text-xs">{log.summary}</p>

                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="text-[10px] font-mono text-slate-400 bg-slate-900/90 p-1.5 rounded mt-1 overflow-x-auto">
                        {JSON.stringify(log.details)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: JURISDICTION POLICIES */}
      {activeTab === 'jurisdictions' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Configurable Minimum-Age Policies by Jurisdiction</h3>
            <p className="text-xs text-slate-400">
              The platform dynamically enforces legal compliance standards per nation or state (COPPA, GDPR Art. 8, UK AADC, PIPA, Australia eSafety).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jurisdictions.map((j) => (
              <div
                key={j.countryCode}
                className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{j.countryName}</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    {j.countryCode}
                  </span>
                </div>

                <div className="space-y-1 text-slate-300 pt-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Minimum Age to Register:</span>
                    <strong className="text-white font-mono">{j.minimumAgeToRegister}+</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Guardian Required Under:</span>
                    <strong className="text-white font-mono">{j.guardianConsentRequiredUnder}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Age-Band Isolation:</span>
                    <span className="text-emerald-400 font-semibold">Strict Active</span>
                  </div>
                </div>

                <div className="p-2 bg-slate-900 rounded text-[10px] text-slate-400 mt-2">
                  Standard: <strong className="text-slate-300">{j.regulatoryFramework}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
