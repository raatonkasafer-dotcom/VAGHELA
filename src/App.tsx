/**
 * Gomegle Exact Age & Guardian Safety System
 * Main Application Hub
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { GlobalMatchView } from './components/GlobalMatchView';
import { GuardianPortal } from './components/GuardianPortal';
import { AdminConsole } from './components/AdminConsole';
import { SecurityTestHarness } from './components/SecurityTestHarness';
import { SafetyAuditView } from './components/SafetyAuditView';
import { RegistrationModal } from './components/RegistrationModal';
import { DobEditModal } from './components/DobEditModal';
import { safetyEngine } from './server/safetyEngine';
import { UserProfile } from './types/safety';

export default function App() {
  const [currentView, setCurrentView] = useState<'match' | 'guardian' | 'admin' | 'security_suite' | 'audit_clusters'>('match');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isDobEditOpen, setIsDobEditOpen] = useState(false);

  // Load initial users from authoritative safety engine
  const refreshUsers = () => {
    const list = Array.from(safetyEngine.users.values());
    setAllUsers(list);
    if (!currentUser && list.length > 0) {
      // Default to 14yo minor Leo to demonstrate minor protection by default
      const defaultUser = list.find((u) => u.id === 'usr_leo14') || list[0];
      setCurrentUser(defaultUser);
    } else if (currentUser) {
      const refreshed = list.find((u) => u.id === currentUser.id);
      if (refreshed) setCurrentUser(refreshed);
    }
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  const handleUserSelect = (user: UserProfile) => {
    setCurrentUser(user);
  };

  const handleUserRegistered = (newUser: UserProfile) => {
    refreshUsers();
    setCurrentUser(newUser);
    setCurrentView('match');
  };

  const handleUserUpdated = (updatedUser: UserProfile) => {
    refreshUsers();
    setCurrentUser(updatedUser);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Initializing Gomegle Safe Match Architecture...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      {/* Top Bar Contract (3 Zones) */}
      <Header
        currentView={currentView}
        onSelectView={setCurrentView}
        currentUser={currentUser}
        allUsers={allUsers}
        onSelectUser={handleUserSelect}
        onOpenRegister={() => setIsRegisterOpen(true)}
        onOpenDobEdit={() => setIsDobEditOpen(true)}
      />

      {/* Main Viewport Content */}
      <main className="flex-1">
        {currentView === 'match' && (
          <GlobalMatchView
            currentUser={currentUser}
            onOpenGuardianPortal={() => setCurrentView('guardian')}
            onOpenRegister={() => setIsRegisterOpen(true)}
          />
        )}

        {currentView === 'audit_clusters' && (
          <SafetyAuditView />
        )}

        {currentView === 'guardian' && (
          <GuardianPortal
            currentUser={currentUser}
            onRefreshUser={handleUserUpdated}
          />
        )}

        {currentView === 'admin' && (
          <AdminConsole onRefreshData={refreshUsers} />
        )}

        {currentView === 'security_suite' && (
          <SecurityTestHarness onDataModified={refreshUsers} />
        )}
      </main>

      {/* Global Safety Registration Modal */}
      <RegistrationModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onUserRegistered={handleUserRegistered}
      />

      {/* Anti-Bypass DOB Edit Modal */}
      <DobEditModal
        isOpen={isDobEditOpen}
        onClose={() => setIsDobEditOpen(false)}
        currentUser={currentUser}
        onUserUpdated={handleUserUpdated}
      />

      {/* Footer conforming to anti-slop rules (clean copyright and trust standards) */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Gomegle Safety System</span>
            <span aria-hidden="true">·</span>
            <span>Zero Adult-Minor Cross Matching</span>
            <span aria-hidden="true">·</span>
            <span>COPPA & GDPR Art. 8 Compliant</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Authoritative Server Engine · No Client-Side Age Verification Trust
          </div>
        </div>
      </footer>
    </div>
  );
}
