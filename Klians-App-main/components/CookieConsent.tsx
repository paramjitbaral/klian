import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';

export const CookieConsent: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Small delay before showing so it slides in nicely after app load
    const timer = setTimeout(() => {
      const hasConsented = localStorage.getItem('KLIANS_cookie_consent');
      if (!hasConsented) {
        setIsVisible(true);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleAccept = () => {
    localStorage.setItem('KLIANS_cookie_consent', 'true');
    window.dispatchEvent(new Event('cookie_consent_changed'));
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('KLIANS_cookie_consent', 'false');
    // Actually clear non-essential data when declined!
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('rememberedEmail');
    window.dispatchEvent(new Event('cookie_consent_changed'));
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] py-3 px-4 animate-in slide-in-from-bottom-full duration-700">
      <div className="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
        
        <div className="flex flex-col md:flex-row items-start md:items-center gap-1.5 md:gap-4 text-left flex-1 md:pl-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-sm md:text-lg">🍪</span>
            <h3 className="text-[13px] md:text-base font-bold text-slate-900 dark:text-white tracking-tight">Privacy & Cookies</h3>
          </div>
          <p className="hidden md:block text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
            We use essential cookies to make our site work. With your consent, we may also use non-essential cookies to improve user experience and analyze website traffic.
          </p>
          <p className="md:hidden text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
            We use cookies to improve your experience and analyze traffic.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 shrink-0 w-full md:w-auto pt-1 md:pt-0">
          <button 
            onClick={handleDecline}
            className="flex-1 md:flex-none px-4 py-2 md:py-1.5 text-[11px] md:text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all duration-200"
          >
            Decline
          </button>
          <button 
            onClick={handleAccept}
            className="flex-1 md:flex-none px-5 py-2 md:py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-[11px] md:text-xs font-semibold rounded transition-all duration-200"
          >
            Accept
          </button>
        </div>

      </div>
    </div>
  );
};
