import React, { useState } from 'react';
import { X, ShieldAlert, Flag, Check } from 'lucide-react';
import { SafetyReport, UserProfile } from '../types/safety';
import { safetyEngine } from '../server/safetyEngine';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reporter: UserProfile;
  reportedPeer: { id: string; nickname: string };
  sessionId?: string;
  onReportSubmitted: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  reporter,
  reportedPeer,
  sessionId,
  onReportSubmitted
}) => {
  const [reason, setReason] = useState<SafetyReport['reason']>('UNDERAGE_ADULT_MISMATCH');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    safetyEngine.reportUser({
      reporterId: reporter.id,
      reportedUserId: reportedPeer.id,
      reason,
      description: description.trim() || `Report filed for ${reason}`,
      matchSessionId: sessionId
    });

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onReportSubmitted();
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 text-slate-200 shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Report & Block User</h2>
              <p className="text-[11px] text-slate-400">Immediate Triage & Safety Enforcement</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-white">Report Submitted & Peer Blocked</p>
            <p className="text-xs text-slate-400">The session has been terminated and user banished from your matching queue.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <p className="text-xs text-slate-300">
              Reporting: <strong className="text-white">{reportedPeer.nickname}</strong>
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Primary Violation Reason
              </label>
              <div className="space-y-1.5">
                {[
                  { value: 'UNDERAGE_ADULT_MISMATCH', label: 'Age Discrepancy / Adult in Minor Space' },
                  { value: 'SOLICITATION', label: 'Contact Request / Social Handle / Phone Solicitation' },
                  { value: 'HARASSMENT', label: 'Bullying, Hate Speech, or Intimidation' },
                  { value: 'INAPPROPRIATE_VIDEO', label: 'Inappropriate or Explicit Video Feed' },
                  { value: 'PII_LEAK', label: 'Attempting to extract location or personal identity' },
                  { value: 'OTHER', label: 'Other platform policy violation' }
                ].map((item) => (
                  <label
                    key={item.value}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      reason === item.value
                        ? 'border-red-500/60 bg-red-950/30 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={item.value}
                      checked={reason === item.value}
                      onChange={() => setReason(item.value as SafetyReport['reason'])}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Additional Details (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide any context that will assist moderation review..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-red-500"
              />
            </div>

            <p className="text-[11px] text-slate-400">
              Note: Submitting this report immediately blocks this user permanently and logs an incident in our immutable audit system.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Flag className="w-3.5 h-3.5" />
                Report & Terminate Match
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
