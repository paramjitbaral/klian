import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { OtpInput } from '../components/ui/OtpInput';

export const VerifyPage: React.FC = () => {
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const { verify, resendOTP, loading, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Get email from location state (passed during register/login)
    const state = location.state as { email?: string };
    if (state?.email) {
      setEmail(state.email);
    } else {
      // If no email in state, redirect to auth
      navigate('/auth');
    }
  }, [location, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;

    try {
      await verify(email, otp);
      navigate('/home');
    } catch (err) {
      // Error is handled by context
    }
  };

  const handleResend = async () => {
    try {
      setResendStatus('Sending...');
      await resendOTP(email);
      setResendStatus('Sent!');
      setTimeout(() => setResendStatus(null), 3000);
    } catch (err) {
      setResendStatus(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Verify Account</h1>
          <p className="text-slate-600 dark:text-slate-400">
            We've sent a 6-digit code to <span className="font-semibold text-slate-900 dark:text-white">{email}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-4 text-center">
              Enter Verification Code
            </label>
            <OtpInput value={otp} onChange={setOtp} />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Didn't receive the code?{' '}
            <button 
              onClick={handleResend}
              disabled={loading || !!resendStatus}
              className="text-red-600 font-semibold hover:underline disabled:opacity-50"
            >
              {resendStatus || 'Resend Code'}
            </button>
          </p>
          <button 
            onClick={() => navigate('/auth')}
            className="mt-4 text-slate-500 dark:text-slate-500 text-sm hover:underline"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};
