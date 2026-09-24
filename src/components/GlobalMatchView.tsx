import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Shield,
  ShieldAlert,
  Play,
  Square,
  RotateCw,
  Send,
  UserX,
  Flag,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  EyeOff
} from 'lucide-react';
import { UserProfile, MatchSession, MatchStepLog, ChatMessage } from '../types/safety';
import { safetyEngine } from '../server/safetyEngine';
import { ReportModal } from './ReportModal';
import avatarTeenPath from '../assets/images/avatar_teen_user_1790243927172.jpg';

interface GlobalMatchViewProps {
  currentUser: UserProfile;
  onOpenGuardianPortal: () => void;
  onOpenRegister: () => void;
}

export const GlobalMatchView: React.FC<GlobalMatchViewProps> = ({
  currentUser,
  onOpenGuardianPortal,
  onOpenRegister
}) => {
  const [isMatching, setIsMatching] = useState(false);
  const [currentSession, setCurrentSession] = useState<MatchSession | null>(null);
  const [matchStepLogs, setMatchStepLogs] = useState<MatchStepLog[]>([]);
  const [showStepInspector, setShowStepInspector] = useState(true);
  const [matchFailure, setMatchFailure] = useState<string | null>(null);

  // Video & Audio Controls
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoBlurred, setVideoBlurred] = useState(false);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState<boolean | null>(null);

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null);

  // Reporting & Blocking
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Video element refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Setup WebRTC user media
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((s) => {
          stream = s;
          localStreamRef.current = s;
          setCameraPermissionGranted(true);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = s;
          }
        })
        .catch(() => {
          // Fallback gracefully to virtual avatar stream if camera denied or absent
          setCameraPermissionGranted(false);
        });
    } else {
      setCameraPermissionGranted(false);
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Update track enables when toggled
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = videoEnabled));
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = audioEnabled));
    }
  }, [videoEnabled, audioEnabled]);

  // Scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Execute the strict 10-step server matching sequence
  const startMatching = () => {
    setIsMatching(true);
    setMatchFailure(null);
    setCurrentSession(null);
    setMessages([]);
    setSafetyWarning(null);

    // Run authoritative server sequence
    const result = safetyEngine.executeGlobalMatchSequence(currentUser.id);
    setMatchStepLogs(result.stepLogs);

    if (result.success && result.session) {
      setCurrentSession(result.session);
      setIsMatching(false);

      // Welcome system message
      const isMinor = currentUser.server_calculated_age < 18;
      const initialMsgs: ChatMessage[] = [
        {
          id: 'sys_1',
          matchId: result.session.id,
          senderId: 'system',
          senderName: 'Safety Shield',
          isSenderMinor: false,
          text: isMinor
            ? `Protected Minor Match Established (${result.session.ageGroup}). Real-time PII and predator filter active. Never share phone numbers, social media, or offline addresses.`
            : `Safe Match Established (${result.session.ageGroup}). Adults match exclusively with adults (18+). Automated policy enforcement active.`,
          timestamp: new Date().toISOString(),
          isFlagged: false
        }
      ];
      setMessages(initialMsgs);
    } else {
      setIsMatching(false);
      setMatchFailure(result.failureReason || 'Failed to establish safe match');
    }
  };

  const endMatch = () => {
    if (currentSession) {
      currentSession.endedAt = new Date().toISOString();
      safetyEngine.addAuditLog({
        eventType: 'ADMIN_ACTION',
        actorId: currentUser.id,
        actorRole: 'USER',
        severity: 'INFO',
        summary: `User ${currentUser.nickname} ended match session ${currentSession.id}`,
        details: { sessionId: currentSession.id }
      });
    }
    setCurrentSession(null);
    setMessages([]);
    setSafetyWarning(null);
  };

  const handleNextMatch = () => {
    endMatch();
    startMatching();
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentSession) return;

    const res = safetyEngine.filterAndSendChatMessage(
      currentSession.id,
      currentUser.id,
      chatInput
    );

    if (res.success && res.message) {
      setMessages((prev) => [...prev, res.message!]);
      setChatInput('');
      if (res.warning) {
        setSafetyWarning(res.warning);
        setTimeout(() => setSafetyWarning(null), 6000);
      }
    }
  };

  const handleBlockUser = () => {
    if (!currentSession) return;
    safetyEngine.blockUser(currentUser.id, currentSession.peerProfile.id);
    endMatch();
  };

  const isMinor = currentUser.server_calculated_age < 18;
  const isGuardianVerified = currentUser.guardian_status === 'VERIFIED';
  const hasGuardianConsentIssue = isMinor && currentUser.guardian_required && !isGuardianVerified;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Platform Safety Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-white tracking-tight">
                Gomegle Global Match Engine
              </h1>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-mono text-indigo-400">
                Active Pool: {currentUser.age_group}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {isMinor ? 'Minor Protection Active' : 'Adult Segmentation Active'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Strict 10-step server verification enforced before every peer connection. Zero adult-minor cross-matching.
            </p>
          </div>
        </div>

        {/* Current User Safety Status Badge */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-800">
          <div className="text-right">
            <div className="text-[11px] text-slate-400">Server Age Verification:</div>
            <div className="text-xs font-semibold text-slate-200">
              {currentUser.nickname} (
              <span className="text-indigo-400 font-mono">
                {currentUser.server_calculated_age} yrs
              </span>
              ) · <span className="text-amber-300">{currentUser.age_verified}</span>
            </div>
          </div>

          {hasGuardianConsentIssue && (
            <button
              onClick={onOpenGuardianPortal}
              className="px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-xs"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Guardian Consent Needed
            </button>
          )}
        </div>
      </div>

      {/* Main Video & Chat Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left / Video Stage (7 cols on lg) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Dual Video Viewports */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* 1. Local Video Feed */}
            <div className="relative aspect-4/3 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-md flex flex-col justify-between p-3">
              {cameraPermissionGranted ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover -scale-x-100 ${
                    videoBlurred ? 'blur-md' : ''
                  }`}
                />
              ) : (
                /* Fallback virtual camera when physical camera is absent or permission denied */
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 flex flex-col items-center justify-center p-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-2">
                    <Video className="w-8 h-8" />
                  </div>
                  <p className="text-xs font-medium text-slate-300">Virtual Safe Camera Stream</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                    No hardware webcam detected. Safe simulated video feed active.
                  </p>
                </div>
              )}

              {/* Local Feed Overlay Header */}
              <div className="relative z-10 flex items-center justify-between text-xs bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-md text-slate-200">
                <span className="font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  You ({currentUser.nickname})
                </span>
                <span className="font-mono text-[11px] text-indigo-300">
                  {currentUser.age_group} · {currentUser.country}
                </span>
              </div>

              {/* Local Video Controls Overlay */}
              <div className="relative z-10 flex items-center justify-between gap-1 text-xs">
                <div className="flex items-center gap-1 bg-black/60 backdrop-blur-xs p-1 rounded-lg">
                  <button
                    onClick={() => setVideoEnabled(!videoEnabled)}
                    className={`p-1.5 rounded transition-colors ${
                      videoEnabled ? 'text-slate-300 hover:text-white' : 'text-red-400 bg-red-950/80'
                    }`}
                    title={videoEnabled ? 'Mute Video' : 'Unmute Video'}
                  >
                    {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => setAudioEnabled(!audioEnabled)}
                    className={`p-1.5 rounded transition-colors ${
                      audioEnabled ? 'text-slate-300 hover:text-white' : 'text-red-400 bg-red-950/80'
                    }`}
                    title={audioEnabled ? 'Mute Mic' : 'Unmute Mic'}
                  >
                    {audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => setVideoBlurred(!videoBlurred)}
                    className={`p-1.5 rounded transition-colors ${
                      videoBlurred ? 'text-amber-400 bg-amber-950/80' : 'text-slate-300 hover:text-white'
                    }`}
                    title={videoBlurred ? 'Unblur Video' : 'Blur Video for Privacy'}
                  >
                    <EyeOff className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-[10px] text-slate-400 bg-black/60 backdrop-blur-xs px-2 py-1 rounded">
                  No Auto-Recording Guaranteed
                </div>
              </div>
            </div>

            {/* 2. Matched Peer Video Feed */}
            <div className="relative aspect-4/3 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-md flex flex-col justify-between p-3">
              {currentSession ? (
                <>
                  {/* Peer simulated live video feed */}
                  <img
                    src={avatarTeenPath}
                    alt={currentSession.peerProfile.nickname}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/60 pointer-events-none" />

                  {/* Peer Header Badge */}
                  <div className="relative z-10 flex items-center justify-between text-xs bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-md text-slate-200">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="font-semibold">{currentSession.peerProfile.nickname}</span>
                      {currentSession.peerProfile.is_verified_minor && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-indigo-500/30 text-indigo-300 rounded font-medium">
                          Guardian Verified
                        </span>
                      )}
                    </div>
                    {/* PRIVACY RULE: NEVER SHOW EXACT DOB OR AGE FOR MINORS */}
                    <span className="text-[11px] font-medium text-slate-300">
                      {currentSession.peerProfile.age_category} · {currentSession.peerProfile.country}
                    </span>
                  </div>

                  {/* Safe Peer Tags */}
                  <div className="relative z-10 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {currentSession.peerProfile.interests.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] bg-slate-900/90 text-slate-300 border border-slate-700/60 px-2 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Session in-call controls */}
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/10">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setIsReportOpen(true)}
                          className="px-2 py-1 text-[11px] font-medium text-red-300 hover:text-white bg-red-950/70 hover:bg-red-900/80 border border-red-800/50 rounded flex items-center gap-1 transition-colors"
                          title="Report peer for safety violation"
                        >
                          <Flag className="w-3 h-3" />
                          Report
                        </button>

                        <button
                          onClick={handleBlockUser}
                          className="px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 rounded flex items-center gap-1 transition-colors"
                          title="Block user and end session"
                        >
                          <UserX className="w-3 h-3" />
                          Block
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleNextMatch}
                          className="px-2.5 py-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded flex items-center gap-1 transition-colors shadow-xs"
                        >
                          <RotateCw className="w-3 h-3" />
                          Next
                        </button>

                        <button
                          onClick={endMatch}
                          className="px-2.5 py-1 text-[11px] font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded flex items-center gap-1 transition-colors"
                        >
                          <Square className="w-3 h-3" />
                          Disconnect
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Empty / Waiting state */
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-3">
                    <Shield className="w-7 h-7 text-indigo-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">Safe Matching Ready</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    {hasGuardianConsentIssue
                      ? 'Parental/Guardian consent must be verified before connecting with peers in your age group.'
                      : `You will only be paired with verified peers in your exact group: ${currentUser.age_group}.`}
                  </p>

                  <div className="mt-4">
                    {hasGuardianConsentIssue ? (
                      <button
                        onClick={onOpenGuardianPortal}
                        className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors flex items-center gap-2 shadow-xs"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        Verify Guardian Consent
                      </button>
                    ) : (
                      <button
                        onClick={startMatching}
                        disabled={isMatching}
                        className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 rounded-lg transition-colors shadow-sm flex items-center gap-2"
                      >
                        {isMatching ? (
                          <>
                            <RotateCw className="w-4 h-4 animate-spin" />
                            Evaluating 10-Step Server Safety...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Start Safe Match ({currentUser.age_group})
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Match Failure Alert */}
          {matchFailure && (
            <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-xs text-red-200 flex items-start gap-2.5">
              <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-100">Match Sequence Halted by Server Safety Engine</p>
                <p className="text-red-300/90 mt-0.5">{matchFailure}</p>
                {matchFailure.includes('Guardian') && (
                  <button
                    onClick={onOpenGuardianPortal}
                    className="mt-2 text-[11px] underline font-medium text-amber-300 hover:text-amber-200"
                  >
                    Open Guardian Dashboard to activate consent →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* The 10-Step Server Safety Pipeline Inspector */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowStepInspector(!showStepInspector)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-200 hover:bg-slate-850 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span>10-Step Server Safety Pipeline Audit</span>
                <span className="text-[10px] font-normal text-slate-400">
                  (Evaluated server-side before match)
                </span>
              </div>
              {showStepInspector ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showStepInspector && (
              <div className="p-4 border-t border-slate-800/80 space-y-2 text-xs">
                {matchStepLogs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {matchStepLogs.map((log) => (
                      <div
                        key={log.stepNumber}
                        className={`p-2 rounded-lg border text-[11px] flex items-start gap-2 ${
                          log.passed
                            ? 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                            : 'bg-red-950/30 border-red-900/60 text-red-200'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {log.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white flex items-center justify-between">
                            <span>
                              {log.stepNumber}. {log.title}
                            </span>
                            <span className="font-mono text-[9px] text-slate-500">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-slate-400 mt-0.5 truncate" title={log.details}>
                            {log.details}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-400 text-center py-3 text-[11px]">
                    Click "Start Safe Match" to trigger and inspect the server's 10-step eligibility sequence in real time.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right / Safe Chat Stage (4 cols on lg) */}
        <div className="lg:col-span-4 flex flex-col h-[560px] bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
          
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              <h2 className="text-xs font-semibold text-white">Safe Text Chat</h2>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Real-Time PII Shield
            </span>
          </div>

          {/* Safety Warning Toast */}
          {safetyWarning && (
            <div className="p-2.5 bg-amber-950/80 border-b border-amber-900 text-[11px] text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>{safetyWarning}</span>
            </div>
          )}

          {/* Message Stream */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                <Shield className="w-8 h-8 text-slate-700 mb-2" />
                <p className="text-xs font-medium text-slate-300">No Active Chat Session</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Start a match to begin communicating with a verified peer.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.senderId === currentUser.id;
                const isSys = m.senderId === 'system';

                if (isSys) {
                  return (
                    <div
                      key={m.id}
                      className="p-2 bg-indigo-950/40 border border-indigo-900/50 rounded-lg text-[11px] text-indigo-300 text-center"
                    >
                      {m.text}
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[10px] text-slate-400 mb-0.5">
                      {isMe ? 'You' : m.senderName}
                    </span>
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                        m.isFlagged
                          ? 'bg-red-950/70 border border-red-800 text-red-200'
                          : isMe
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-200 border border-slate-700/60'
                      }`}
                    >
                      {m.text}
                      {m.isFlagged && (
                        <div className="text-[10px] text-red-400 mt-1 flex items-center gap-1 font-semibold">
                          <AlertTriangle className="w-3 h-3" />
                          {m.flagReason}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="p-2.5 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={
                currentSession
                  ? 'Type safe message (PII will be redacted)...'
                  : 'Start match to chat...'
              }
              disabled={!currentSession}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!currentSession || !chatInput.trim()}
              className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg transition-colors shadow-xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Chat Moderation Rules Notice */}
          <div className="px-3 py-1.5 bg-slate-950 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Automated Predatory Pattern & Phone/Handle Filter</span>
            <span className="text-indigo-400 font-mono">3 Strikes = Restriction</span>
          </div>

        </div>

      </div>

      {/* Categorical Report Modal */}
      {currentSession && (
        <ReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          reporter={currentUser}
          reportedPeer={{
            id: currentSession.peerProfile.id,
            nickname: currentSession.peerProfile.nickname
          }}
          sessionId={currentSession.id}
          onReportSubmitted={() => {
            endMatch();
          }}
        />
      )}
    </div>
  );
};
