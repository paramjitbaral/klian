import { useState, useEffect } from 'react';

export const useCookieConsent = () => {
    const [consent, setConsent] = useState<boolean | null>(null);

    useEffect(() => {
        const checkConsent = () => {
            const val = localStorage.getItem('klias_cookie_consent');
            if (val === 'true') setConsent(true);
            else if (val === 'false') setConsent(false);
            else setConsent(null);
        };
        
        checkConsent();
        
        window.addEventListener('storage', checkConsent);
        window.addEventListener('cookie_consent_changed', checkConsent);
        
        return () => {
            window.removeEventListener('storage', checkConsent);
            window.removeEventListener('cookie_consent_changed', checkConsent);
        };
    }, []);

    return consent;
};
