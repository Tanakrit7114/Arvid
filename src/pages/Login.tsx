import React, { useState, useEffect } from 'react';
import { auth, googleProvider, db } from '../firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signInWithCustomToken } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { LogIn, UserPlus, Mail, Lock, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Validate origin is from AI Studio preview or localhost
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }

      if (event.data?.type === 'DISCORD_LOGIN_SUCCESS') {
        const { customToken, userData } = event.data;
        setLoading(true);
        setError('');
        try {
          await signInWithCustomToken(auth, customToken);
          
          // Sync user data on client side where we have permission
          if (userData) {
            try {
              await setDoc(doc(db, "users", userData.uid), {
                ...userData,
                lastLogin: new Date().toISOString()
              }, { merge: true });
            } catch (fsError) {
              console.error("Client Firestore User Sync Error:", fsError);
            }
          }
          
          navigate('/dashboard');
        } catch (err: any) {
          console.error("Firebase Custom Token Login Error:", err);
          setError(`Login Failed: ${err.message}`);
        } finally {
          setLoading(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/dashboard');
    } catch (err: any) {
      console.error("Google Login Error:", err);
      setError(`${err.code || 'Error'}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscordLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/discord/login-url');
      const { url } = await response.json();
      
      window.open(url, 'discord_login', 'width=500,height=750');
    } catch (err: any) {
      console.error("Discord Login URL Error:", err);
      setError(`Failed to start Discord login: ${err.message}`);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isRegister) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
          await updateProfile(userCredential.user, { displayName });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/dashboard');
    } catch (err: any) {
      console.error("Login/Register Error:", err);
      setError(`${err.code || 'Error'}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface border border-border p-8 rounded-[2rem] max-w-md w-full shadow-2xl shadow-accent/10"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black font-heading mb-2">
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-muted">
            {isRegister ? 'Join Arvid today' : 'Login to manage your servers'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input
                type="text"
                placeholder="Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl py-2.5 pl-10 pr-4 focus:border-accent outline-none transition-all"
                required={isRegister}
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl py-2.5 pl-10 pr-4 focus:border-accent outline-none transition-all"
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl py-2.5 pl-10 pr-4 focus:border-accent outline-none transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-accent hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : isRegister ? (
              <><UserPlus size={20} /> Register</>
            ) : (
              <><LogIn size={20} /> Login</>
            )}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface px-2 text-muted">Or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="py-3 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-100 transition-all"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
            Google
          </button>
          <button
            onClick={handleDiscordLogin}
            disabled={loading}
            className="py-3 bg-[#5865F2] text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-[#4752C4] transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 127.14 96.36" fill="currentColor">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.71,32.65-1.78,56.63.48,80.21a105.73,105.73,0,0,0,32.21,16.15c2.54-3.45,4.8-7.14,6.68-11a68.11,68.11,0,0,1-10.65-5.1c.91-.66,1.8-1.35,2.66-2.07a75.28,75.28,0,0,0,64.32,0c.86.72,1.75,1.41,2.66,2.07a67.89,67.89,0,0,1-10.65,5.1c1.88,3.82,4.14,7.51,6.68,11a105.73,105.73,0,0,0,32.21-16.15C129.58,50.49,125.1,26.54,107.7,8.07ZM42.45,65.69c-6.22,0-11.38-5.71-11.38-12.73s5-12.73,11.38-12.73,11.38,5.71,11.38,12.73S48.67,65.69,42.45,65.69Zm42.24,0c-6.22,0-11.38-5.71-11.38-12.73s5-12.73,11.38-12.73,11.38,5.71,11.38,12.73S84.69,65.69,84.24,65.69Z"/>
            </svg>
            Discord
          </button>
        </div>

        <p className="text-center text-sm text-muted">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-accent font-bold hover:underline"
          >
            {isRegister ? 'Login' : 'Register'}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
