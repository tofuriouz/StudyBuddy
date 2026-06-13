import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, User, LogOut, AlertCircle, Loader2, CheckCircle2
} from 'lucide-react';
import { 
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const clearStates = () => {
    setError('');
    setSuccess('');
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      
      onAuthChange(userCredential.user);
      setSuccess('Logged in successfully!');
      setTimeout(() => {
        onClose();
        clearStates();
      }, 1500);
    } catch (err: any) {
      console.error('Auth error: ', err);
      let errMsg = 'Authentication failed. Please check your connection or popup blocker.';
      
      if (err.code === 'auth/popup-closed-by-user') {
        errMsg = 'Login was cancelled. Please try again.';
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
                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">Username</p>
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
          <div className="space-y-4 text-center mt-2" id="account-auth-form">
            <p className="text-[11px] text-zinc-400 pb-2 border-b border-zinc-900/50">
              Sign in to safely synchronize your clock and focus history across all your devices.
            </p>
            
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-3 py-3 border border-sky-900/50 bg-sky-950/20 hover:bg-sky-900/40 hover:border-sky-800 rounded-lg text-xs font-semibold text-sky-100 tracking-wider transition cursor-pointer uppercase disabled:opacity-50 shadow-lg shadow-sky-900/10"
              id="account-google-auth"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M23.52 12.2741C23.52 11.4236 23.4436 10.6038 23.3018 9.81665H12V14.4619H18.4527C18.1745 15.9621 17.3345 17.2343 16.0527 18.0931V21.1097H19.9309C22.2055 19.0145 23.52 15.9255 23.52 12.2741Z" fill="#fff"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M12.0001 24.0001C15.2401 24.0001 17.9619 22.9272 19.931 21.1098L16.0528 18.0932C14.9892 18.8055 13.6146 19.2319 12.0001 19.2319C8.8746 19.2319 6.2237 17.123 5.2746 14.2862H1.2709V17.391C3.2455 21.3149 7.2928 24.0001 12.0001 24.0001Z" fill="#fff"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M5.2746 14.2862C5.0346 13.5662 4.8982 12.7963 4.8982 12.0001C4.8982 11.2039 5.0346 10.434 5.2746 9.71401V6.60925H1.2709C0.4636 8.21735 0 10.0525 0 12.0001C0 13.9477 0.4636 15.7828 1.2709 17.3909L5.2746 14.2862Z" fill="#fff"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M12.0001 4.76814C13.7619 4.76814 15.3437 5.37365 16.5873 6.56272L20.0182 3.13184C17.9564 1.20546 15.2401 0 12.0001 0C7.2928 0 3.2455 2.68516 1.2709 6.60912L5.2746 9.71388C6.2237 6.87713 8.8746 4.76814 12.0001 4.76814Z" fill="#fff"/>
                </svg>
              )}
              <span>Continue with Google</span>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
