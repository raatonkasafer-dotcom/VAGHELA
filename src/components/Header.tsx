import React from 'react';
import { Shield, ShieldAlert, Users, UserCheck, AlertTriangle, UserPlus, Lock, Activity } from 'lucide-react';
import { UserProfile } from '../types/safety';

interface HeaderProps {
  currentView: 'match' | 'guardian' | 'admin' | 'security_suite' | 'audit_clusters';
  onSelectView: (view: 'match' | 'guardian' | 'admin' | 'security_suite' | 'audit_clusters') => void;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  onOpenRegister: () => void;
  onOpenDobEdit: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onSelectView,
  currentUser,
  allUsers,
  onSelectUser,
  onOpenRegister,
  onOpenDobEdit
}) => {
  const isMinor = currentUser.server_calculated_age < 18;

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => onSelectView('match')}
            className="flex items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
          >
            <span className="font-bold text-xl tracking-tight text-white flex items-center gap-1.5">
              <Shield className="w-5 h-5 text-indigo-400 fill-indigo-400/20" />
              Gomegle
            </span>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              · Safe Match Engine
            </span>
          </button>
        </div>

        {/* Zone 2: 4-6 clean text navigation links */}
        <nav className="flex items-center gap-1 sm:gap-3 overflow-x-auto py-1">
          <button
            onClick={() => onSelectView('match')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              currentView === 'match'
                ? 'text-white bg-slate-800/90 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            Safe Video Match
          </button>

          <button
            onClick={() => onSelectView('audit_clusters')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              currentView === 'audit_clusters'
                ? 'text-white bg-slate-800/90 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            Safety Audit View
          </button>

          <button
            onClick={() => onSelectView('guardian')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              currentView === 'guardian'
                ? 'text-white bg-slate-800/90 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            Guardian Portal
          </button>

          <button
            onClick={() => onSelectView('admin')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              currentView === 'admin'
                ? 'text-white bg-slate-800/90 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            Admin Console
          </button>

          <button
            onClick={() => onSelectView('security_suite')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              currentView === 'security_suite'
                ? 'text-white bg-slate-800/90 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            Anti-Bypass Suite
          </button>
        </nav>

        {/* Zone 3: Active Profile Switcher & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Persona Switcher for Quick Evaluation */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
            <label htmlFor="user-select" className="sr-only">Switch User Persona</label>
            <select
              id="user-select"
              value={currentUser.id}
              onChange={(e) => {
                const user = allUsers.find(u => u.id === e.target.value);
                if (user) onSelectUser(user);
              }}
              className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer pr-1 truncate max-w-[140px] sm:max-w-[170px]"
            >
              {allUsers.map((u) => (
                <option key={u.id} value={u.id} className="bg-slate-900 text-slate-100">
                  {u.nickname} ({u.server_calculated_age}y · {u.age_group})
                </option>
              ))}
            </select>

            <button
              onClick={onOpenDobEdit}
              title="Test server anti-bypass DOB change"
              className="text-[11px] px-1.5 py-0.5 text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded transition-colors whitespace-nowrap"
            >
              Edit DOB
            </button>
          </div>

          <button
            onClick={onOpenRegister}
            className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Register DOB
          </button>
        </div>

      </div>
    </header>
  );
};
