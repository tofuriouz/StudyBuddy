import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Lock, User, LogIn, UserPlus, LogOut, AlertCircle, Loader2, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from '../firebase';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: FirebaseUser | null;
  onAuthChange: (user: FirebaseUser | null) => void;
  totalLogsCount: number;
}

export default function AccountModal({ 
  isOpen, 
  onClose, 
  currentUser, 
  onAuthChange,
  totalLogsCount
}: AccountModalProps) {
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Suffix helper to treat plain usernames as emails internally for Firebase
  const formatUsernameToEmail = (raw: string): string => {
    const clean = raw.trim();
    if (clean.includes('@')) {
      return clean; // If user input standard email, use it directly
    }
    // Else map plain username to safe email suffix
    return `${clean.toLowerCase()}@focusapp.local`;
  };

  const clearStates = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  };

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError('Please enter a username or email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      if (isRegister) {
        // Sign Up Flow
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setIsLoading(false);
          return;
        }

        const email = formatUsernameToEmail(cleanUsername);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Also update displayName to represent the custom username
        const displayName = cleanUsername.includes('@') ? cleanUsername.split('@')[0] : cleanUsername;
        await updateProfile(userCredential.user, { displayName });
        
        onAuthChange(userCredential.user);
        setSuccess('Account created successfully! Syncing logs...');
        setTimeout(() => {
          onClose();
          clearStates();
        }, 1500);
      } else {
        // Sign In Flow
        const email = formatUsernameToEmail(cleanUsername);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        onAuthChange(userCredential.user);
        setSuccess('Logged in successfully!');
        setTimeout(() => {
          onClose();
          clearStates();
        }, 1500);
      }
    } catch (err: any) {
      console.error('Auth error: ', err);
      let errMsg = 'Authentication failed. Please verify configurations.';
      
      if (err.code === 'auth/email-already-in-use') {
        errMsg = 'Username or email is already taken.';
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        errMsg = 'Incorrect username, email, or password.';
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
      onAuthChange(null);
      setSuccess('Logged out successfully.');
      setTimeout(() => {
        onClose();
        clearStates();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Failed to logout.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      id="account-modal-overlay"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm bg-black border border-zinc-900 rounded-2xl overflow-hidden p-6 shadow-2xl space-y-6 text-zinc-100 font-mono"
        id="account-modal-container"
      >
        {/* Header Block */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-3" id="account-modal-header">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-sky-400" />
            <span className="text-xs uppercase tracking-widest font-semibold text-white">
              {currentUser ? 'Your Profile' : 'Accs Setup'}
            </span>
          </div>
          <button
            onClick={() => {
              onClose();
              clearStates();
            }}
            disabled={isLoading}
            className="p-1 hover:bg-zinc-900/50 rounded-lg text-zinc-500 hover:text-white transition cursor-pointer"
            id="account-modal-close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Display Status Alerts */}
        {error && (
          <div className="flex items-start gap-2 bg-orange-950/20 border border-orange-900/20 p-3 rounded-lg text-[10px] text-orange-400" id="account-error">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-orange-400" />
            <p className="leading-normal">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 bg-emerald-950/20 border border-emerald-950 p-3 rounded-lg text-[10px] text-emerald-400" id="account-success">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p className="leading-normal">{success}</p>
          </div>
        )}

        {currentUser ? (
          /* Logged In View */
          <div className="space-y-5" id="account-profile-view">
            <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-sky-500/10 border border-sky-450 rounded-lg p-2 flex items-center justify-center">
                  <User className="h-5 w-5 text-sky-300" />
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">Username/Alias</p>
                  <p className="text-sm font-semibold text-white">{currentUser.displayName || currentUser.email?.split('@')[0]}</p>
                </div>
              </div>

              <div className="border-t border-zinc-900 pt-3 flex justify-between items-center text-[10px] text-zinc-400">
                <span>Safe Cloud Sync:</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Enabled
                </span>
              </div>

              <div className="flex justify-between items-center text-[10px] text-zinc-400">
                <span>Synced logs in Cloud:</span>
                <span className="font-semibold text-zinc-200">{totalLogsCount} entries</span>
              </div>
            </div>

            <div className="text-[9px] text-zinc-500 leading-normal text-center max-w-xs mx-auto">
              Your logs and timer durations are synchronized with the cloud so you never lose focus history.
            </div>

            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2 border border-zinc-850 hover:bg-zinc-950 hover:text-white rounded-lg text-[11px] font-semibold text-zinc-400 tracking-wider transition cursor-pointer uppercase disabled:opacity-50"
              id="account-logout-btn"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
              ) : (
                <LogOut className="h-3 w-3" />
              )}
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          /* Log In / Register Form */
          <form onSubmit={handleAuthAction} className="space-y-4" id="account-auth-form">
            <div className="space-y-3.5">
              <div>
                <label className="block text-[9.5px] uppercase tracking-widest text-zinc-500 font-semibold mb-1">
                  Username or Email
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    required
                    maxLength={50}
                    disabled={isLoading}
                    placeholder="e.g. marcus"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-950/40 border border-zinc-900 rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-sky-400/50 focus:bg-black font-mono transition-all"
                  />
                </div>
                {!isRegister && (
                  <span className="text-[8px] text-zinc-600 font-mono mt-0.5 block">
                    Tip: Enter custom username (e.g. <span className="text-zinc-500">marcus</span>) to keep it simple!
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[9.5px] uppercase tracking-widest text-zinc-500 font-semibold mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    maxLength={32}
                    disabled={isLoading}
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-950/40 border border-zinc-900 rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-sky-400/50 focus:bg-black font-mono transition-all"
                  />
                </div>
              </div>

              {isRegister && (
                <div>
                  <label className="block text-[9.5px] uppercase tracking-widest text-zinc-500 font-semibold mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      maxLength={32}
                      disabled={isLoading}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-zinc-950/40 border border-zinc-900 rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-sky-400/50 focus:bg-black font-mono transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2 border border-zinc-800 bg-zinc-900/20 hover:bg-zinc-900 hover:text-white rounded-lg text-[11px] font-semibold text-zinc-200 tracking-wider transition cursor-pointer uppercase disabled:opacity-50"
              id="account-auth-submit"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin text-sky-400" />
              ) : isRegister ? (
                <UserPlus className="h-3 w-3" />
              ) : (
                <LogIn className="h-3 w-3" />
              )}
              <span>{isRegister ? 'Create Free Account' : 'Sign In'}</span>
            </button>

            <div className="text-center pt-2 border-t border-zinc-900 text-[10px]" id="account-auth-toggle">
              {isRegister ? (
                <p className="text-zinc-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(false);
                      setError('');
                    }}
                    className="text-sky-400 hover:text-sky-350 cursor-pointer font-semibold underline"
                  >
                    Log In
                  </button>
                </p>
              ) : (
                <p className="text-zinc-500">
                  New users?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(true);
                      setError('');
                    }}
                    className="text-sky-400 hover:text-sky-350 cursor-pointer font-semibold underline"
                  >
                    Register free
                  </button>
                </p>
              )}
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
