import React, { useState } from 'react';
import { X, AlertTriangle, ShieldCheck, Lock } from 'lucide-react';
import { UserProfile, DateOfBirth } from '../types/safety';
import { safetyEngine } from '../server/safetyEngine';

interface DobEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => CURRENT_YEAR - i);

export const DobEditModal: React.FC<DobEditModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated
}) => {
  const [day, setDay] = useState(currentUser.date_of_birth.day);
  const [month, setMonth] = useState(currentUser.date_of_birth.month);
  const [year, setYear] = useState(currentUser.date_of_birth.year);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpdateDob = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const newDob: DateOfBirth = { day, month, year };
    
    // Server-side anti-bypass update
    const res = safetyEngine.updateDateOfBirth(
      currentUser.id,
      newDob,
      'USER',
      reason.trim() || 'User requested DOB update through anti-bypass interface'
    );

    if (!res.success) {
      setError(res.error || 'Failed to update date of birth');
      return;
    }

    if (res.user) {
      onUserUpdated(res.user);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 text-slate-200 shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Anti-Bypass DOB Modification</h2>
              <p className="text-[11px] text-slate-400">Server Recalculation & Audit Enforcement</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 p-3 bg-amber-950/40 border border-amber-800/50 rounded-lg text-xs text-amber-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-200">Strict Child Safety Protection Notice</p>
            <p className="text-[11px] text-amber-300/90 mt-0.5">
              Changing your date of birth resets age verification to <strong>REQUIRES_REVIEW</strong>, triggers an immutable safety audit log, recalculates age server-side, and alerts your guardian if you are a minor.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-2 bg-red-950/60 border border-red-900 text-xs text-red-300 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleUpdateDob} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Current DOB on Server:
            </label>
            <div className="text-xs font-mono text-slate-300 bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
              Day {currentUser.date_of_birth.day}, Month {currentUser.date_of_birth.month}, Year {currentUser.date_of_birth.year} ({currentUser.server_calculated_age} years old · {currentUser.age_group})
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Select New Exact Date of Birth
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Day</label>
                <select
                  value={day}
                  onChange={(e) => setDay(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-100"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Month</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-100"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Year</label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-100"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Reason for Adjustment
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Typo in registration year"
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-md transition-colors shadow-xs"
            >
              Submit Server Change
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
