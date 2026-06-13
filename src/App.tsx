/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ActivityMode, CumulativeTime, LogEntry } from './types';
import { ACTIVITY_CONFIGS } from './constants';
import { playModeSwitchSound, playResetSound } from './components/SoundHelper';
import TimerCard from './components/TimerCard';
import DailyCircles from './components/DailyCircles';
import CountDownScreen from './components/CountDownScreen';
import { getPSTDayBoundaries } from './utils/timezone';
import {
  Volume2,
  VolumeX,
  RotateCcw,
  Check,
  History,
  Trash2,
  Download,
  Activity,
  Layers,
  User,
  LogIn,
  Loader2
} from 'lucide-react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, getDocFromServer, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import AccountModal from './components/AccountModal';

const LOCAL_STORAGE_KEYS = {
  ACTIVE_MODE: 'cot_active_mode',
  LAST_STATE_CHANGE: 'cot_last_state_change',
  CUMULATIVE_TIME: 'cot_cumulative_time',
  LOGS: 'cot_logs',
  SESSION_START: 'cot_session_start',
  SOUND_ENABLED: 'cot_sound_enabled',
  CURRENT_PROJECT: 'cot_current_project',
};

const DEFAULT_CUMULATIVE_TIMES: CumulativeTime = {
  STUDYING: 0,
  NOT_STUDYING: 0,
};

export interface ArcSlice {
  id: string;
  config: any;
  strokeDashoffset: number;
  rotation: number;
  pct: number;
  tooltipData?: {
    label: string;
    startTimeMs: number;
    endTimeMs: number;
  };
}

export default function App() {
  // --- Persistent States ---
  const [activeMode, setActiveMode] = useState<ActivityMode>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.ACTIVE_MODE);
      if (saved && Object.values(ActivityMode).includes(saved as ActivityMode)) {
        return saved as ActivityMode;
      }
    } catch {}
    return ActivityMode.NOT_STUDYING;
  });

  const [lastStateChange, setLastStateChange] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_STATE_CHANGE);
      if (saved) return parseInt(saved, 10);
    } catch {}
    return Date.now();
  });

  const [cumulativeTime, setCumulativeTime] = useState<CumulativeTime>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.CUMULATIVE_TIME);
      if (saved) {
        const parsed = JSON.parse(saved);
        const migrated: CumulativeTime = {
          STUDYING: parsed.STUDYING || 0,
          NOT_STUDYING: parsed.NOT_STUDYING || 0,
        };
        // Accumulate and merge any legacy activity times safely into NOT_STUDYING
        Object.keys(parsed).forEach((key) => {
          if (key !== 'STUDYING' && key !== 'NOT_STUDYING') {
            migrated.NOT_STUDYING += (parsed[key] || 0);
          }
        });
        return migrated;
      }
    } catch {}
    return { ...DEFAULT_CUMULATIVE_TIMES };
  });

  const [logs, setLogs] = useState<LogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.LOGS);
      if (saved) {
        const loadedLogs = JSON.parse(saved) as LogEntry[];
        // Map historical legacy keys elegantly to NOT_STUDYING
        return loadedLogs.map((log) => {
          if (log.mode !== ActivityMode.STUDYING && log.mode !== ActivityMode.NOT_STUDYING) {
            return { ...log, mode: ActivityMode.NOT_STUDYING };
          }
          return log;
        });
      }
    } catch {}
    return [];
  });

  const [sessionStart, setSessionStart] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.SESSION_START);
      if (saved) return parseInt(saved, 10);
    } catch {}
    return Date.now();
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.SOUND_ENABLED);
      if (saved) return saved === 'true';
    } catch {}
    return true; // Default sound on
  });

  const [currentProject, setCurrentProject] = useState<'logger' | 'count'>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.CURRENT_PROJECT) as 'logger' | 'count';
      if (saved) return saved;
    } catch {}
    return 'logger';
  });

  // --- Runtime States ---
  const [now, setNow] = useState<number>(Date.now());
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [hoveredArc, setHoveredArc] = useState<ArcSlice | null>(null);

  const isStudying = activeMode === ActivityMode.STUDYING;

  // --- Account & Firebase States ---
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState<boolean>(false);

  // Authenticated State Handler & Sync logic
  useEffect(() => {
    // Initial verification of server connection as mandated
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    let unsubUser: (() => void) | null = null;
    let unsubLogs: (() => void) | null = null;

    const testAndSubscribe = async (user: FirebaseUser) => {
      setIsLoadingCloud(true);
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          // New cloud registration - push current state to initialize the cloud database
          await setDoc(userDocRef, {
            userId: user.uid,
            activeMode,
            lastStateChange,
            sessionStart,
            cumulativeTime
          });

          for (const localLog of logs) {
            await setDoc(doc(db, 'users', user.uid, 'logs', localLog.id), localLog);
          }
        }
      } catch (err) {
        console.error("Error bootstrapping cloud data: ", err);
      } finally {
        setIsLoadingCloud(false);
      }

      // Live subscription to user settings document
      const userDocRef = doc(db, 'users', user.uid);
      unsubUser = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          if (userData.activeMode) {
            setActiveMode(prev => prev !== userData.activeMode ? (userData.activeMode as ActivityMode) : prev);
          }
          if (userData.lastStateChange) {
            setLastStateChange(prev => prev !== userData.lastStateChange ? userData.lastStateChange : prev);
          }
          if (userData.sessionStart) {
            setSessionStart(prev => prev !== userData.sessionStart ? userData.sessionStart : prev);
          }
          if (userData.cumulativeTime) {
            setCumulativeTime(prev => {
              const cloudCum = userData.cumulativeTime as CumulativeTime;
              const changed = Object.keys(cloudCum).some(
                key => prev[key as ActivityMode] !== cloudCum[key as ActivityMode]
              );
              return changed ? cloudCum : prev;
            });
          }
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      });

      // Live subscription to focus log entries
      const logsColRef = collection(db, 'users', user.uid, 'logs');
      unsubLogs = onSnapshot(logsColRef, (logsSnap) => {
        const cloudLogs: LogEntry[] = [];
        logsSnap.forEach((docSnap) => {
          cloudLogs.push(docSnap.data() as LogEntry);
        });

        // Sort descending by startTime to keep standard descending list
        cloudLogs.sort((a, b) => b.startTime - a.startTime);
        setLogs(cloudLogs);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}/logs`);
      });
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      
      // Clean up previous subscriptions if any (e.g. on log out)
      if (unsubUser) { unsubUser(); unsubUser = null; }
      if (unsubLogs) { unsubLogs(); unsubLogs = null; }

      if (user) {
        testAndSubscribe(user);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUser) unsubUser();
      if (unsubLogs) unsubLogs();
    };
  }, []);

  // --- Core Tick Loop ---
  useEffect(() => {
    // Request persistent storage so the browser doesn't automatically evict data under storage pressure.
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then(isPersisted => {
        if (!isPersisted) {
          navigator.storage.persist().catch(() => {});
        }
      });
    }

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 200); // Ticks 5 times per second for responsive stopwatch
    return () => clearInterval(interval);
  }, []);

  // --- Local Storage Synchronization ---
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_MODE, activeMode);
      localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_STATE_CHANGE, lastStateChange.toString());
      localStorage.setItem(LOCAL_STORAGE_KEYS.CUMULATIVE_TIME, JSON.stringify(cumulativeTime));
      
      // Ensure logs don't exceed LocalStorage limits (~5MB) by retaining the maximum robust history (~15k recent entries)
      const logsToSave = logs.length > 15000 ? logs.slice(0, 15000) : logs;
      localStorage.setItem(LOCAL_STORAGE_KEYS.LOGS, JSON.stringify(logsToSave));
      
      localStorage.setItem(LOCAL_STORAGE_KEYS.SESSION_START, sessionStart.toString());
      localStorage.setItem(LOCAL_STORAGE_KEYS.SOUND_ENABLED, soundEnabled ? 'true' : 'false');
      localStorage.setItem(LOCAL_STORAGE_KEYS.CURRENT_PROJECT, currentProject);
    } catch (e) {
      console.warn('LocalStorage save error', e);
    }
  }, [activeMode, lastStateChange, cumulativeTime, logs, sessionStart, soundEnabled, currentProject]);


  // --- Helper Calculations ---
  const activeConfig = ACTIVITY_CONFIGS[activeMode];

  // Compute live real-time totals (base + active segment)
  const computeLiveTotals = (): Record<ActivityMode, number> => {
    const computed = { ...cumulativeTime };
    const offset = Math.max(0, now - lastStateChange);
    computed[activeMode] = (computed[activeMode] || 0) + offset;
    return computed;
  };

  const liveTotals = computeLiveTotals();
  const totalMs = Object.values(liveTotals).reduce((sum, curr) => sum + curr, 0);

  // Active mode's live ticking stopwatch duration
  const activeLiveMs = liveTotals[activeMode];

  // --- Actions ---
  const handleActivateMode = async (newMode: ActivityMode) => {
    let modeToSet = newMode;
    
    // Toggle design: If they click an active mode, fall back to NOT_STUDYING
    if (newMode === activeMode) {
      if (newMode === ActivityMode.NOT_STUDYING) {
        return; // Clicked active Not Studying; stays active
      } else {
        modeToSet = ActivityMode.NOT_STUDYING; // Defaults to resting/not studying
      }
    }

    const elapsed = Date.now() - lastStateChange;
    const finalElapsed = Math.max(0, elapsed);

    let loggedEntry: LogEntry | null = null;

    // Save previous active block to log history
    if (finalElapsed >= 1000) { // Log blocks of at least 1 second
      const newLog: LogEntry = {
        id: Math.random().toString(36).substring(2, 9),
        mode: activeMode,
        startTime: lastStateChange,
        endTime: Date.now(),
        duration: finalElapsed,
      };
      setLogs((prev) => [newLog, ...prev]);
      loggedEntry = newLog;
    }

    const updatedCumulative = {
      ...cumulativeTime,
      [activeMode]: (cumulativeTime[activeMode] || 0) + finalElapsed,
    };

    // Allocate time to the departing mode
    setCumulativeTime(updatedCumulative);

    // Update active pointers
    playModeSwitchSound(soundEnabled);
    setActiveMode(modeToSet);
    const nowTime = Date.now();
    setLastStateChange(nowTime);

    // Sync to Firestore if user logged in
    if (currentUser) {
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, {
          userId: currentUser.uid,
          activeMode: modeToSet,
          lastStateChange: nowTime,
          sessionStart,
          cumulativeTime: updatedCumulative
        });

        if (loggedEntry) {
          await setDoc(doc(db, 'users', currentUser.uid, 'logs', loggedEntry.id), loggedEntry);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);
      }
    }
  };

  const handleDeleteLog = async (id: string) => {
    const targetLog = logs.find((l) => l.id === id);
    if (!targetLog) return;

    const updatedCumulative = {
      ...cumulativeTime,
      [targetLog.mode]: Math.max(0, (cumulativeTime[targetLog.mode] || 0) - targetLog.duration),
    };

    setCumulativeTime(updatedCumulative);
    setLogs((prev) => prev.filter((log) => log.id !== id));

    if (currentUser) {
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, {
          userId: currentUser.uid,
          activeMode,
          lastStateChange,
          sessionStart,
          cumulativeTime: updatedCumulative
        });

        await deleteDoc(doc(db, 'users', currentUser.uid, 'logs', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${currentUser.uid}/logs/${id}`);
      }
    }
  };

  const handleResetSession = async () => {
    playResetSound(soundEnabled);
    setCumulativeTime({ ...DEFAULT_CUMULATIVE_TIMES });
    setLogs([]);
    setActiveMode(ActivityMode.NOT_STUDYING);
    setLastStateChange(Date.now());
    setSessionStart(Date.now());
    setShowResetConfirm(false);

    if (currentUser) {
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, {
          userId: currentUser.uid,
          activeMode: ActivityMode.NOT_STUDYING,
          lastStateChange: Date.now(),
          sessionStart: Date.now(),
          cumulativeTime: { ...DEFAULT_CUMULATIVE_TIMES }
        });

        const logsColRef = collection(db, 'users', currentUser.uid, 'logs');
        const logsSnap = await getDocs(logsColRef);
        for (const docSnap of logsSnap.docs) {
          await deleteDoc(docSnap.ref);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);
      }
    }
  };

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Date', 'Start Time', 'End Time', 'Duration (s)', 'Mode'];
    const rows = logs.map(log => {
      const d = new Date(log.startTime);
      const dateStr = d.toLocaleDateString();
      const startStr = d.toLocaleTimeString();
      const endStr = new Date(log.endTime).toLocaleTimeString();
      const config = ACTIVITY_CONFIGS[log.mode] || ACTIVITY_CONFIGS[ActivityMode.NOT_STUDYING];
      const modeLabel = config.label;
      const durationSecs = Math.floor(log.duration / 1000);
      return [dateStr, startStr, endStr, durationSecs, modeLabel].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time_logs_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Format stopwatch readout
  const formatStopwatch = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;

    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  const formatLogDuration = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // --- Chronological 24h Timeline for the Big Dial (Calibrated to PST) ---
  const { startMs, endMs } = getPSTDayBoundaries(now);
  const DAY_MS = 24 * 60 * 60 * 1000;

  const circleRadius = 105;
  const circleCircumference = 2 * Math.PI * circleRadius; // ~659.73

  const todayArcs: ArcSlice[] = [];

  // Plot each historic log precisely where it occurred chronologically
  logs.forEach(log => {
      const logEndTime = log.startTime + log.duration;
      // Skip completely out of bounds
      if (log.startTime > endMs || logEndTime < startMs) return; 

      // Clamp exactly to today's PST boundaries
      const activeStart = Math.max(log.startTime, startMs);
      const activeEnd = Math.min(logEndTime, endMs);
      const durationMs = activeEnd - activeStart;
      
      if (durationMs <= 0) return;

      const pct = durationMs / DAY_MS;
      const startPct = (activeStart - startMs) / DAY_MS;
      const strokeDashoffset = circleCircumference - (circleCircumference * pct);
      const rotation = (startPct * 360) - 90; // -90 deg represents North/12AM

      const config = ACTIVITY_CONFIGS[log.mode] || ACTIVITY_CONFIGS[ActivityMode.NOT_STUDYING];
      todayArcs.push({
        id: log.id,
        config,
        strokeDashoffset,
        rotation,
        pct,
        tooltipData: {
          label: config.label,
          startTimeMs: activeStart,
          endTimeMs: activeEnd
        }
      });
  });

  // Plot the current continuously ticking segment
  const liveStart = Math.max(lastStateChange, startMs);
  const liveEnd = Math.min(now, endMs);
  const liveDurationMs = liveEnd - liveStart;
  
  if (liveDurationMs > 0) {
      const pct = liveDurationMs / DAY_MS;
      const startPct = (liveStart - startMs) / DAY_MS;
      const config = ACTIVITY_CONFIGS[activeMode] || ACTIVITY_CONFIGS[ActivityMode.NOT_STUDYING];
      todayArcs.push({
        id: 'live-segment',
        config,
        strokeDashoffset: circleCircumference - (circleCircumference * pct),
        rotation: (startPct * 360) - 90,
        pct,
        tooltipData: {
          label: config.label,
          startTimeMs: liveStart,
          endTimeMs: liveEnd
        }
      });
  }

  return (
    <>
      {!isStudying && (
        <div className="fixed bottom-6 right-6 z-[9999] p-1 bg-black border border-zinc-900 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.8)] flex items-center backdrop-blur-xl gap-0.5 pointer-events-auto">
          <button
            onClick={() => setCurrentProject('logger')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono tracking-wider transition-all duration-200 cursor-pointer ${
              currentProject === 'logger' ? 'bg-zinc-900 border border-zinc-800 text-sky-300 shadow-inner' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
            }`}
          >
            <Activity className="w-3 h-3" /> Dial
          </button>
          <button
            onClick={() => setCurrentProject('count')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono tracking-wider transition-all duration-200 cursor-pointer ${
              currentProject === 'count' ? 'bg-zinc-900 border border-zinc-800 text-sky-300 shadow-inner' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
            }`}
          >
            <Layers className="w-3 h-3" /> Focus
          </button>
        </div>
      )}

      {currentProject === 'count' ? (
        <CountDownScreen />
      ) : (
        <div className="min-h-screen bg-black text-zinc-100 font-mono selection:bg-sky-500/30 selection:text-white pb-12" id="main-applet">
      
        {/* Sleek Minimal Swiss Header */}
        {!isStudying && (
          <header className="border-b border-zinc-900/60 bg-black sticky top-0 z-50 px-4 md:px-8 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 hover:text-white border border-zinc-800 hover:bg-zinc-900 px-2.5 py-1.5 rounded transition-all cursor-pointer uppercase tracking-wider disabled:opacity-50"
                disabled={logs.length === 0}
                title="Export timeline to CSV"
              >
                <Download className="h-3 w-3" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            </div>

            {/* Header Controls */}
            <div className="flex items-center gap-2">
              {/* Accounts login & cloud status */}
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] border font-mono uppercase tracking-wider transition-all cursor-pointer ${
                  currentUser
                    ? 'border-sky-950 bg-sky-950/10 text-sky-400 hover:bg-sky-950/30'
                    : 'border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
                title={currentUser ? `Logged in as ${currentUser.displayName || currentUser.email?.split('@')[0]}` : 'Sign Up / Log In to Cloud Sync'}
                id="btn-account-auth"
              >
                {isLoadingCloud ? (
                  <Loader2 className="h-3 w-3 animate-spin text-sky-400" />
                ) : currentUser ? (
                  <>
                    <User className="h-3 w-3 text-sky-400" />
                    <span className="max-w-[70px] truncate">{currentUser.displayName || currentUser.email?.split('@')[0]}</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-3 w-3" />
                    <span>Log In / Register</span>
                  </>
                )}
              </button>

              {/* Clean Reset Button */}
              {!showResetConfirm ? (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="p-1.5 text-zinc-500 hover:text-white rounded-lg transition-all cursor-pointer text-[11px] font-mono uppercase tracking-wider flex items-center gap-1"
                  title="Reset state"
                  id="btn-reset-session-start"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-orange-950/20 border border-orange-900/10 px-2 py-0.5 rounded-md text-[10px]" id="reset-confirm-box">
                  <span className="text-[9px] text-orange-400/80 font-mono tracking-tight">RESET?</span>
                  <button
                    onClick={handleResetSession}
                    className="text-orange-400 hover:text-orange-300 font-bold tracking-wider cursor-pointer"
                    id="btn-reset-confirm"
                  >
                    YES
                  </button>
                  <span className="text-zinc-750">/</span>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="text-zinc-400 hover:text-zinc-300 font-semibold cursor-pointer"
                    id="btn-reset-cancel"
                  >
                    NO
                  </button>
                </div>
              )}
            </div>
          </header>
        )}

        {/* Main Single Frame */}
        <main className={`max-w-xl mx-auto px-4 ${isStudying ? 'py-16 md:py-24 flex flex-col items-center justify-center min-h-[85vh]' : 'py-8 space-y-6'}`}>
        
        {/* Dynamic Centerpiece - Big 24 hour circle with the timer inside of it */}
        <div className="flex flex-col items-center justify-center py-4" id="hero-24h-dial-container">
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 flex items-center justify-center">
            
            {/* Contextual Floating Tooltip */}
            <AnimatePresence>
              {hoveredArc?.tooltipData && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute -top-16 left-1/2 -tranzinc-x-1/2 bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 shadow-2xl z-50 flex flex-col items-center min-w-[140px] pointer-events-none"
                >
                  <div className="flex items-center gap-1.5 mb-1.5 border-b border-zinc-800 pb-1 w-full justify-center">
                    <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: hoveredArc.config.accentColor }} />
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">{hoveredArc.tooltipData.label}</span>
                  </div>
                  <span className="text-[9px] text-zinc-500 font-mono">
                    {new Date(hoveredArc.tooltipData.startTimeMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} 
                    {' - '}
                    {new Date(hoveredArc.tooltipData.endTimeMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Background 24h dial SVG containing proportional arcs, hour marks, and hour texts */}
            <svg className="absolute inset-0 w-full h-full transform select-none" viewBox="0 0 260 260">
              {/* Slate-900 background circle representing untracked / rest of day space */}
              <circle
                cx="130"
                cy="130"
                r={circleRadius}
                stroke="#1e293b"
                strokeWidth={7}
                fill="transparent"
                className="opacity-40"
              />

              {/* Dynamic activity segments for custom visual composition */}
              {todayArcs.map((arc, idx) => (
                <circle
                  key={idx}
                  cx="130"
                  cy="130"
                  r={circleRadius}
                  stroke={arc.config.accentColor}
                  strokeWidth={hoveredArc?.id === arc.id ? 10 : 7}
                  fill="transparent"
                  strokeDasharray={`${circleCircumference} ${circleCircumference}`}
                  strokeDashoffset={arc.strokeDashoffset}
                  transform={`rotate(${arc.rotation} 130 130)`}
                  strokeLinecap={arc.pct > 0.005 ? "round" : "butt"} // soft edges for significant slices
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredArc(arc)}
                  onMouseLeave={() => setHoveredArc(null)}
                  onTouchStart={() => setHoveredArc(arc)}
                  onTouchEnd={() => setHoveredArc(null)}
                  style={{ pointerEvents: 'stroke' }}
                />
              ))}

              {/* Classic Swiss-style 24-hour tick divisions */}
              {Array.from({ length: 24 }).map((_, i) => {
                const angle = (i * 360) / 24;
                const angleRad = (angle - 90) * (Math.PI / 180);
                const x1 = 130 + 114 * Math.cos(angleRad);
                const y1 = 130 + 114 * Math.sin(angleRad);
                const x2 = 130 + 118 * Math.cos(angleRad);
                const y2 = 130 + 118 * Math.sin(angleRad);
                const isQuarter = i % 6 === 0;

                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isQuarter ? '#64748b' : '#334155'}
                    strokeWidth={isQuarter ? 1.5 : 1}
                    className="opacity-60"
                  />
                );
              })}

              {/* Clean minimal labels marking four corners of the 24h grid */}
              <text x="130" y="8" textAnchor="middle" className="text-[7.5px] font-mono font-bold fill-zinc-500 tracking-wider">12AM</text>
              <text x="254" y="133" textAnchor="middle" className="text-[7.5px] font-mono font-bold fill-zinc-500 tracking-wider">6AM</text>
              <text x="130" y="258" textAnchor="middle" className="text-[7.5px] font-mono font-bold fill-zinc-500 tracking-wider">12PM</text>
              <text x="6" y="133" textAnchor="middle" className="text-[7.5px] font-mono font-bold fill-zinc-500 tracking-wider">6PM</text>
            </svg>

            {/* Inner Absolute Content (the stopwatch widget itself) */}
            <button
              onClick={() => handleActivateMode(isStudying ? ActivityMode.NOT_STUDYING : ActivityMode.STUDYING)}
              className="absolute inset-9 bg-black rounded-full border border-zinc-900/60 shadow-inner flex flex-col items-center justify-center p-4 text-center z-10 space-y-2.5 transition-transform hover:scale-[1.03] cursor-pointer group focus:outline-none"
              title={activeMode === ActivityMode.STUDYING ? "Tap to Pause/Rest" : "Tap to Start Studying"}
            >
              
              {/* Active Category State */}
              <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-mono uppercase tracking-widest flex items-center gap-1 border transition-all ${activeConfig.bgClass} ${activeConfig.textClass} ${activeConfig.borderClass}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${activeMode === ActivityMode.NOT_STUDYING ? 'bg-zinc-500' : 'bg-sky-400 animate-pulse'}`} />
                <span>{activeConfig.label}</span>
              </span>

              {/* Giant Digit Ticker */}
              <h2 className="text-3xl sm:text-4xl font-mono font-light tracking-tight text-white select-none">
                {formatStopwatch(activeLiveMs)}
              </h2>

              {isStudying ? (
                <span className="text-[9px] font-mono text-sky-400/65 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                  Tap to Pause
                </span>
              ) : (
                <span className="text-[9px] font-mono text-zinc-500/60 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                  Tap to Study
                </span>
              )}

            </button>

          </div>
        </div>

        {/* Extra widgets hidden when studying is active for distraction-free Focus */}
        {!isStudying && (
          <>
            {/* Grid of 6 Minimalist Category State Triggers */}
            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Set Focus Flow</span>
                <span className="text-[10px] font-mono text-zinc-600 uppercase">Toggles on click</span>
              </div>

              <div className="grid grid-cols-2 gap-2" id="timer-cards-grid">
                {Object.values(ACTIVITY_CONFIGS).map((config) => {
                  const isCardActive = activeMode === config.mode;
                  const accumulatedVal = liveTotals[config.mode];

                  return (
                    <TimerCard
                      key={config.mode}
                      config={config}
                      isActive={isCardActive}
                      accumulatedMs={accumulatedVal}
                      totalMs={totalMs}
                      onActivate={handleActivateMode}
                    />
                  );
                })}
              </div>
            </section>

            {/* Quietly Integrated 7-Day Activity Circles widget */}
            <DailyCircles 
              logs={logs} 
              activeMode={activeMode} 
              lastStateChange={lastStateChange} 
            />
          </>
        )}

      </main>


    </div>
      )}

      <AccountModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onAuthChange={(user) => setCurrentUser(user)}
        totalLogsCount={logs.length}
      />
    </>
  );
}


