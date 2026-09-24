import React, { useState, useMemo } from 'react';
import { X, Shield, Calendar, AlertCircle, CheckCircle2, User, Globe, Mail } from 'lucide-react';
import { DateOfBirth, JurisdictionPolicy, UserProfile } from '../types/safety';
import { safetyEngine, DEFAULT_JURISDICTIONS } from '../server/safetyEngine';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserRegistered: (user: UserProfile) => void;
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

const SAFE_INTERESTS_POOL = [
  'Coding & Robotics',
  'Digital Art & Animation',
  'Science & Astronomy',
  'Indie Gaming & Minecraft',
  'Music Production',
  'Reading & Creative Writing',
  'Chess & Strategy Games',
  'Languages & Cultures',
  'Environmental Science',
  'Math & Puzzles'
];

export const RegistrationModal: React.FC<RegistrationModalProps> = ({
  isOpen,
  onClose,
  onUserRegistered
}) => {
  const [nickname, setNickname] = useState('');
  const [country, setCountry] = useState('US');
  const [day, setDay] = useState<number>(15);
  const [month, setMonth] = useState<number>(6);
  const [year, setYear] = useState<number>(2010); // default minor for demonstration
  const [guardianEmail, setGuardianEmail] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['Coding & Robotics', 'Digital Art & Animation']);
  const [error, setError] = useState<string | null>(null);

  const selectedPolicy: JurisdictionPolicy = useMemo(() => {
    return DEFAULT_JURISDICTIONS[country] || DEFAULT_JURISDICTIONS['GLOBAL'];
  }, [country]);

  // Real-time server-formula preview of age calculation
  const calculatedAgeInfo = useMemo(() => {
    try {
      const dob: DateOfBirth = { day, month, year };
      const age = safetyEngine.calculateExactAge(dob);
      const group = safetyEngine.determineAgeGroup(age);
      const isUnderLegalMin = age < selectedPolicy.minimumAgeToRegister;
      const isMinor = age < 18;
      const guardianRequired = isMinor && age < selectedPolicy.guardianConsentRequiredUnder;

      return {
        age,
        group,
        isUnderLegalMin,
        isMinor,
        guardianRequired,
        valid: true
      };
    } catch {
      return { age: 0, group: 'Under 13', isUnderLegalMin: true, isMinor: true, guardianRequired: true, valid: false };
    }
  }, [day, month, year, selectedPolicy]);

  if (!isOpen) return null;

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      if (selectedInterests.length < 4) {
        setSelectedInterests([...selectedInterests, interest]);
      }
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nickname.trim()) {
      setError('Please provide a display nickname (safe pseudonym).');
      return;
    }

    if (calculatedAgeInfo.isUnderLegalMin) {
      setError(`Platform minimum age for ${selectedPolicy.countryName} is ${selectedPolicy.minimumAgeToRegister} years old.`);
      return;
    }

    if (calculatedAgeInfo.guardianRequired && (!guardianEmail || !guardianEmail.includes('@'))) {
      setError('A valid guardian email is strictly required for users under legal consent age.');
      return;
    }

    const res = safetyEngine.registerUser({
      nickname: nickname.trim(),
      country,
      dob: { day, month, year },
      guardianEmail: calculatedAgeInfo.guardianRequired ? guardianEmail.trim() : undefined,
      interests: selectedInterests,
      hobbies: ['Creative Project', 'Learning']
    });

    if (!res.success) {
      setError(res.error || 'Registration failed server-side');
      return;
    }

    if (res.user) {
      onUserRegistered(res.user);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 text-slate-200 shadow-2xl relative my-8">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Safe User Registration</h2>
              <p className="text-xs text-slate-400">Strict Age & Guardian Consent Engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-950/50 border border-red-900/60 rounded-lg text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="mt-4 space-y-4">
          {/* Pseudonym Display Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Display Nickname (Pseudonym)
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. PixelPioneer or CodeSeeker"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              maxLength={24}
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Privacy rule: Never use your real full name, address, or school in your nickname.
            </p>
          </div>

          {/* Country / Jurisdiction */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              Jurisdiction / Country of Residence
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              {Object.values(DEFAULT_JURISDICTIONS).map((j) => (
                <option key={j.countryCode} value={j.countryCode}>
                  {j.countryName} ({j.regulatoryFramework})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Jurisdiction minimum age: <span className="text-indigo-300 font-medium">{selectedPolicy.minimumAgeToRegister}+</span> · Guardian consent required under: <span className="text-indigo-300 font-medium">{selectedPolicy.guardianConsentRequiredUnder}</span>
            </p>
          </div>

          {/* EXACT DATE OF BIRTH: DAY, MONTH, YEAR */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                Exact Date of Birth (Mandatory)
              </label>
              <span className="text-[11px] text-amber-400/90 font-mono">Server Enforced</span>
            </div>
            
            <p className="text-[11px] text-slate-400 mb-3">
              Per platform safety standards, users cannot self-declare an arbitrary age number. You must select Day, Month, and Year.
            </p>

            <div className="grid grid-cols-3 gap-2">
              {/* Day */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Day</label>
                <select
                  value={day}
                  onChange={(e) => setDay(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-md px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Month</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-md px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Year</label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-md px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live Server Calculation Badge */}
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Server Age Evaluation:</span>
              <span className="font-mono text-slate-200">
                <strong className="text-indigo-400">{calculatedAgeInfo.age} yrs</strong>
                <span className="text-slate-500 mx-1">·</span>
                <span>Group: {calculatedAgeInfo.group}</span>
              </span>
            </div>

            {calculatedAgeInfo.isUnderLegalMin && (
              <div className="mt-2 text-[11px] text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Under age for {selectedPolicy.countryName} ({selectedPolicy.minimumAgeToRegister}+ required). Registration will be blocked.</span>
              </div>
            )}
          </div>

          {/* Guardian Email if Required */}
          {calculatedAgeInfo.guardianRequired && (
            <div className="bg-amber-950/20 border border-amber-900/40 rounded-lg p-3">
              <label className="block text-xs font-semibold text-amber-200 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                Parent or Legal Guardian Email (Mandatory)
              </label>
              <input
                type="email"
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                placeholder="parent.guardian@example.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                required={calculatedAgeInfo.guardianRequired}
              />
              <p className="text-[11px] text-amber-300/80 mt-1">
                Parental consent is legally mandated for minors under {selectedPolicy.guardianConsentRequiredUnder}. Matching features remain locked until your guardian confirms consent via their secure portal.
              </p>
            </div>
          )}

          {/* Pre-approved safe interest tags */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Select Safe Interests (Max 4)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SAFE_INTERESTS_POOL.map((tag) => {
                const isSelected = selectedInterests.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleInterest(tag)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={calculatedAgeInfo.isUnderLegalMin}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Register & Enforce Safety
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
