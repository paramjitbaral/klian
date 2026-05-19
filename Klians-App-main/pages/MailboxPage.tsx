import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { MOCK_EMAILS, MOCK_SENT_EMAILS, MOCK_TRASHED_EMAILS, ICONS } from '../constants';
import { useMessages } from '../contexts/MessagesContext';
import { Email } from '../types';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ComposeMail, ComposeMailData } from '../components/ComposeMail';
import { Avatar } from '../components/ui/Avatar';
import { SharedPostCard } from '../components/SharedPostCard';
import { emailsAPI } from '../src/api/emails';

// Icons
const RefreshIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M20 4s-1.5-2-5-2-6 3-6 6-1.5 6-1.5 6M4 20s1.5 2 5 2 6-3 6-6 1.5-6 1.5-6" /></svg>;
const ContactsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const SearchIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const HamburgerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>;

// Extended Email type to include post data
interface EmailWithPost extends Email {
    type?: 'text' | 'post';
    postData?: {
        _id: string;
        content: string;
        user?: {
            name: string;
            email: string;
            profilePicture: string;
        };
        image?: string;
        createdAt?: string;
        likes?: any[];
        comments?: any[];
    };
    optionalMessage?: string;
}

type ActiveFolder = 'inbox' | 'sent' | 'trash';
export type ComposeWindowState = 'closed' | 'minimized' | 'normal' | 'maximized';

const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).replace(',', '');
};

const EmailListItem: React.FC<{ email: Email, onClick: () => void, activeFolder: ActiveFolder }> = ({ email, onClick, activeFolder }) => {
    const isSentFolder = activeFolder === 'sent';
    const partyToShow = isSentFolder ? email.recipient : email.sender;
    const nameToShow = isSentFolder ? `To: ${partyToShow.name}` : partyToShow.name;

    // Dynamically derive brand logo using Google Favicon API
    const emailStr = partyToShow.email || '';
    const domainMatch = emailStr.split('@')[1];
    const domain = domainMatch ? domainMatch.replace(/>/g, '').trim().toLowerCase() : '';

    const isLocalDomain = !domain || domain.includes('localhost') || domain.includes('klians.com') || domain.includes('campus.local');
    const brandLogoUrl = isLocalDomain ? null : `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;

    const [logoFailed, setLogoFailed] = useState(false);

    return (
        <li onClick={onClick} className="flex items-start gap-4 p-4 border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 cursor-pointer transition-colors duration-150">
            <div className="flex-shrink-0">
                {brandLogoUrl && !logoFailed ? (
                    <img
                        src={brandLogoUrl}
                        alt={partyToShow.initial}
                        onError={() => setLogoFailed(true)}
                        className="h-10 w-10 rounded-full object-contain bg-white border border-slate-100 dark:border-slate-850"
                    />
                ) : (
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg ${partyToShow.color}`}>
                        {partyToShow.initial}
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                    <p className={`font-semibold truncate ${!email.isRead && activeFolder === 'inbox' ? 'text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                        {nameToShow}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0 ml-4">
                        {formatTimestamp(email.timestamp)}
                    </p>
                </div>
                <p className={`font-bold truncate mt-0.5 ${!email.isRead && activeFolder === 'inbox' ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
                    {email.subject}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {email.preview}
                </p>
            </div>
            <div className="flex-shrink-0 self-center ml-2">
                {!email.isRead && activeFolder === 'inbox' && (
                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full" aria-label="Unread email"></div>
                )}
            </div>
        </li>
    );
};

export const MailboxPage: React.FC = () => {
    const { user } = useAuth();
    const { messages: contextMessages, conversations } = useMessages();

    const [inboxEmails, setInboxEmails] = useState<EmailWithPost[]>([]);
    const [sentEmails, setSentEmails] = useState<EmailWithPost[]>([]);
    const [trashedEmails, setTrashedEmails] = useState<EmailWithPost[]>([]);

    const [inboxNextPageToken, setInboxNextPageToken] = useState<string | null>(null);
    const [sentNextPageToken, setSentNextPageToken] = useState<string | null>(null);
    const [trashNextPageToken, setTrashNextPageToken] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);

    const [activeFolder, setActiveFolder] = useState<ActiveFolder>('inbox');
    const [selectedEmail, setSelectedEmail] = useState<EmailWithPost | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

    const [composeState, setComposeState] = useState<ComposeWindowState>('closed');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSearchActive, setIsSearchActive] = useState(false);

    // Dynamically toggle the sticky bottom navigation and search buttons in mobile view when sidebar opens/closes
    useEffect(() => {
        const bottomNav = document.querySelector('nav.fixed.bottom-0');
        const searchBtn = document.querySelector('div.fixed.bottom-5');

        if (isMobileMenuOpen) {
            if (bottomNav) {
                bottomNav.classList.add('opacity-0', 'pointer-events-none', 'invisible', 'transition-all', 'duration-300');
                bottomNav.classList.remove('opacity-100');
            }
            if (searchBtn) {
                searchBtn.classList.add('opacity-0', 'pointer-events-none', 'invisible', 'transition-all', 'duration-300');
                searchBtn.classList.remove('opacity-100');
            }
        } else {
            if (bottomNav) {
                bottomNav.classList.remove('opacity-0', 'pointer-events-none', 'invisible');
                bottomNav.classList.add('opacity-100');
            }
            if (searchBtn) {
                searchBtn.classList.remove('opacity-0', 'pointer-events-none', 'invisible');
                searchBtn.classList.add('opacity-100');
            }
        }

        return () => {
            if (bottomNav) {
                bottomNav.classList.remove('opacity-0', 'pointer-events-none', 'invisible');
            }
            if (searchBtn) {
                searchBtn.classList.remove('opacity-0', 'pointer-events-none', 'invisible');
            }
        };
    }, [isMobileMenuOpen]);

    const [replyContent, setReplyContent] = useState('');
    const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const MAX_REPLY_LENGTH = 1000;
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; email?: string; provider?: string }>({ connected: false });

    // Premium custom modal state
    const [modal, setModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'alert' | 'confirm';
        onConfirm?: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'alert'
    });

    const showAlert = (title: string, message: string) => {
        setModal({
            isOpen: true,
            title,
            message,
            type: 'alert'
        });
    };

    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        setModal({
            isOpen: true,
            title,
            message,
            type: 'confirm',
            onConfirm
        });
    };

    const checkGmailStatus = async () => {
        try {
            const status = await emailsAPI.getGmailStatus();
            setGmailStatus(status);
        } catch (err) {
            console.error('Failed to check Email sync status:', err);
        }
    };

    const handleConnectGmail = () => {
        const token = localStorage.getItem('token');
        if (!token) {
            showAlert('Authentication Required', 'Please log in first.');
            return;
        }

        showAlert('Connecting...', 'Redirecting you to Google OAuth 2.0 Secure Sync.');

        setTimeout(() => {
            window.location.href = `http://localhost:5000/api/email/google?token=${encodeURIComponent(token)}`;
        }, 1000);
    };

    const handleConnectOutlook = () => {
        const token = localStorage.getItem('token');
        if (!token) {
            showAlert('Authentication Required', 'Please log in first.');
            return;
        }

        showAlert('Connecting...', 'Redirecting you to Microsoft Outlook Secure Sync.');

        setTimeout(() => {
            window.location.href = `http://localhost:5000/api/emails/outlook?token=${encodeURIComponent(token)}`;
        }, 1000);
    };

    const handleDisconnectGmail = async () => {
        const providerName = gmailStatus.provider === 'outlook' ? 'Outlook' : gmailStatus.provider === 'campus' ? 'Campus' : 'Gmail';
        showConfirm(
            'Disconnect Integration',
            `Are you sure you want to disconnect your ${providerName} connection? You will fall back to local mailbox onboarding.`,
            async () => {
                try {
                    await emailsAPI.disconnectGmail();
                    setGmailStatus({ connected: false });
                    showAlert('Disconnected', `${providerName} disconnected successfully.`);
                    setSelectedEmail(null);
                } catch (err) {
                    console.error(`Failed to disconnect ${providerName}:`, err);
                    showAlert('Failed to Disconnect', `Failed to disconnect ${providerName}.`);
                }
            }
        );
    };

    useEffect(() => {
        checkGmailStatus();
    }, []);

    // Fetch emails from API for the active folder only (Huge performance optimization!)
    const fetchEmails = async (searchVal = searchTerm) => {
        try {
            setLoading(true);
            if (activeFolder === 'inbox') {
                const res = await emailsAPI.getInbox('', searchVal);
                setInboxEmails(res.emails || []);
                setInboxNextPageToken(res.nextPageToken || null);
            } else if (activeFolder === 'sent') {
                const res = await emailsAPI.getSent('', searchVal);
                setSentEmails(res.emails || []);
                setSentNextPageToken(res.nextPageToken || null);
            } else {
                const res = await emailsAPI.getTrash('', searchVal);
                setTrashedEmails(res.emails || []);
                setTrashNextPageToken(res.nextPageToken || null);
            }
        } catch (err) {
            console.error(`Failed to fetch ${activeFolder} emails:`, err);
        } finally {
            setLoading(false);
        }
    };

    const loadMoreEmails = async (token: string | null) => {
        if (!token || loadingMore) return;
        try {
            setLoadingMore(true);
            if (activeFolder === 'inbox') {
                const res = await emailsAPI.getInbox(token, searchTerm);
                setInboxEmails(prev => [...prev, ...(res.emails || [])]);
                setInboxNextPageToken(res.nextPageToken || null);
            } else if (activeFolder === 'sent') {
                const res = await emailsAPI.getSent(token, searchTerm);
                setSentEmails(prev => [...prev, ...(res.emails || [])]);
                setSentNextPageToken(res.nextPageToken || null);
            } else {
                const res = await emailsAPI.getTrash(token, searchTerm);
                setTrashedEmails(prev => [...prev, ...(res.emails || [])]);
                setTrashNextPageToken(res.nextPageToken || null);
            }
        } catch (err) {
            console.error('Failed to load more emails:', err);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLElement>) => {
        const target = e.currentTarget;
        const isNearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 60;

        let hasMore = false;
        let token: string | null = null;
        if (activeFolder === 'inbox') {
            hasMore = !!inboxNextPageToken;
            token = inboxNextPageToken;
        } else if (activeFolder === 'sent') {
            hasMore = !!sentNextPageToken;
            token = sentNextPageToken;
        } else {
            hasMore = !!trashNextPageToken;
            token = trashNextPageToken;
        }

        if (isNearBottom && hasMore && !loadingMore) {
            loadMoreEmails(token);
        }
    };

    // Snappy search and folder fetch effect with zero-delay clear
    useEffect(() => {
        if (!searchTerm) {
            fetchEmails('');
            return;
        }

        const delayDebounceFn = setTimeout(() => {
            fetchEmails(searchTerm);
        }, 200); // Super snappy 200ms debounce for live typing

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, activeFolder, user]);

    // Real-time automatic background polling every 30 seconds
    useEffect(() => {
        if (!gmailStatus.connected) return;

        const interval = setInterval(() => {
            // Only background sync if the user is not actively searching or loading
            if (!searchTerm && !loading && !loadingMore) {
                fetchEmails('');
            }
        }, 30000); // 30-second synchronization window

        return () => clearInterval(interval);
    }, [gmailStatus.connected, searchTerm, activeFolder, loading, loadingMore]);

    const handleBack = () => {
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            navigate('/home', { replace: true });
        }
    };

    const TrashActionIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
    const RestoreActionIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l4-4m-4 4l4 4" /></svg>;

    const filteredEmails = useMemo(() => {
        let sourceEmails: Email[] = [];
        if (activeFolder === 'inbox') sourceEmails = inboxEmails;
        else if (activeFolder === 'sent') sourceEmails = sentEmails;
        else sourceEmails = trashedEmails;

        return sourceEmails
            .filter(email => {
                if (activeFolder !== 'inbox') return true;
                if (filter === 'unread') return !email.isRead;
                if (filter === 'read') return email.isRead;
                return true;
            });
    }, [filter, activeFolder, inboxEmails, sentEmails, trashedEmails]);

    const handleSendEmail = async (data: ComposeMailData) => {
        if (!user) return;
        try {
            await emailsAPI.sendEmail({
                to: data.to,
                cc: data.cc,
                bcc: data.bcc,
                subject: data.subject,
                body: data.body
            });

            fetchEmails();
            setComposeState('closed');
            showAlert('Success', 'Email sent successfully!');
        } catch (err) {
            console.error('Failed to send email:', err);
            showAlert('Failed to Send', 'Failed to send email. Make sure the recipient email is a registered user.');
        }
    };

    const handleFormatReply = (formatType: 'bold' | 'italic') => {
        const textarea = replyTextareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = replyContent.substring(start, end);

        if (!selectedText) return;

        const formatChars = formatType === 'bold' ? '**' : '*';
        const formattedText = `${formatChars}${selectedText}${formatChars}`;

        const newText = replyContent.substring(0, start) + formattedText + replyContent.substring(end);

        setReplyContent(newText);
    };

    const handleSendReply = async () => {
        if (!user || !selectedEmail || !replyContent.trim()) return;

        const recipientEmail = selectedEmail.sender.email;
        const replySubject = selectedEmail.subject.startsWith('Re: ') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`;
        const replyBody = `<p>${replyContent.replace(/\n/g, '<br />')}</p><br /><blockquote style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex">${selectedEmail.body}</blockquote>`;

        const newReplyEmail: Email = {
            id: `sent-${Date.now()}`,
            sender: {
                name: user.name,
                email: user.email,
                initial: user.name.charAt(0).toUpperCase(),
                color: 'bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-200'
            },
            recipient: selectedEmail.sender,
            subject: replySubject,
            preview: replyContent.substring(0, 100) + '...',
            body: replyBody,
            timestamp: new Date().toISOString(),
            isRead: true,
        };

        // Optimistic UI Update: Instantly save locally and clear input for 0ms lag response
        setSentEmails(prev => [newReplyEmail, ...prev]);
        setSelectedEmail(null);
        setReplyContent('');

        try {
            // Send actual email via Google/Microsoft backend APIs
            await emailsAPI.sendEmail({
                to: [recipientEmail],
                cc: [],
                bcc: [],
                subject: replySubject,
                body: replyBody
            });
            showAlert('Reply Sent', 'Your reply has been sent successfully.');
            fetchEmails();
        } catch (err) {
            console.error('Failed to send reply on server:', err);
            showAlert('Failed to Send', 'Failed to send reply via email server.');
        }
    };

    const adjustIframeHeight = () => {
        const iframe = iframeRef.current;
        if (iframe && iframe.contentWindow) {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                if (doc && doc.body) {
                    doc.body.style.setProperty('background-color', '#ffffff', 'important');
                    doc.body.style.setProperty('background', '#ffffff', 'important');

                    const topLevelEls = doc.body.querySelectorAll('body > table, body > div, body > center, body > center > table, body > center > div');
                    topLevelEls.forEach((el: any) => {
                        const style = el.getAttribute('style') || '';
                        const bgcolor = el.getAttribute('bgcolor') || '';
                        if (style.includes('background') || bgcolor) {
                            el.style.setProperty('background-color', '#ffffff', 'important');
                            el.style.setProperty('background', '#ffffff', 'important');
                            el.removeAttribute('bgcolor');
                        }
                    });

                    iframe.style.height = `${doc.body.scrollHeight + 40}px`;
                }
            } catch (e) {
                iframe.style.height = '600px';
            }
        }
    };

    useEffect(() => {
        if (selectedEmail) {
            const timer = setTimeout(() => {
                adjustIframeHeight();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [selectedEmail]);

    const handleMarkAsRead = async (email: Email) => {
        setSelectedEmail({ ...email, isRead: true });
        setInboxEmails(prev =>
            prev.map(e => e.id === email.id ? { ...e, isRead: true } : e)
        );

        try {
            await emailsAPI.markAsRead(email.id);
        } catch (err) {
            console.error('Failed to mark as read on server:', err);
        }
    };

    const handleMoveToTrash = async (emailId: string) => {
        // Optimistic UI Update: Instantly remove email from the view state for 0ms latency responsiveness!
        setSelectedEmail(null);
        setInboxEmails(prev => prev.filter(e => e.id !== emailId));
        setSentEmails(prev => prev.filter(e => e.id !== emailId));
        setTrashedEmails(prev => prev.filter(e => e.id !== emailId));

        try {
            await emailsAPI.deleteEmail(emailId);
            // Sync with backend silently in the background
            fetchEmails();
        } catch (err) {
            console.error('Failed to move to trash:', err);
            showAlert('Deletion Error', 'Failed to move email to trash on server.');
            // Re-fetch to restore state if the API call failed
            fetchEmails();
        }
    };

    const handleDeletePermanently = (emailId: string) => {
        showConfirm(
            'Delete Email Permanently',
            'Are you sure you want to delete this email permanently? This action cannot be undone.',
            async () => {
                // Optimistic UI Update: Instantly remove from local lists
                setSentEmails(prev => prev.filter(e => e.id !== emailId));
                setTrashedEmails(prev => prev.filter(e => e.id !== emailId));
                setSelectedEmail(null);
                showAlert('Deleted', 'Email deleted permanently.');

                try {
                    await emailsAPI.deletePermanently(emailId);
                    fetchEmails();
                } catch (err) {
                    console.error('Failed to delete permanently on server:', err);
                    showAlert('Deletion Error', 'Failed to delete permanently on server.');
                    fetchEmails();
                }
            }
        );
    };

    const handleRestoreFromTrash = async (emailId: string) => {
        const emailToRestore = trashedEmails.find(e => e.id === emailId);
        if (emailToRestore) {
            // Optimistic UI Update: Move to Inbox immediately
            setTrashedEmails(prev => prev.filter(e => e.id !== emailId));
            setInboxEmails(prev => [emailToRestore, ...prev]);
            setSelectedEmail(null);
            showAlert('Restored', 'Email restored to Inbox.');

            try {
                await emailsAPI.restoreEmail(emailId);
                fetchEmails();
            } catch (err) {
                console.error('Failed to restore on server:', err);
                showAlert('Restore Error', 'Failed to restore email from trash on server.');
                fetchEmails();
            }
        }
    };



    if (!user) return null;

    const folderButtonClasses = (folder: ActiveFolder) =>
        `px-4 py-2 text-left rounded-md transition-colors w-full ${activeFolder === folder
            ? 'bg-red-600 text-white font-semibold'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
        }`;

    const FilterButtons = () => (
        <div className="flex-shrink-0 flex items-center gap-2">
            <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'all' ? 'bg-red-600 text-white' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600'}`}
            >
                All
            </button>
            <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'unread' ? 'bg-red-600 text-white' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600'}`}
            >
                Unread
            </button>
            <button
                onClick={() => setFilter('read')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'read' ? 'bg-red-600 text-white' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600'}`}
            >
                Read
            </button>
        </div>
    );

    const GmailOnboarding = () => (
        <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-3xl mx-auto w-full transition-all duration-300">
            <div className="text-center mb-10">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 tracking-tight mb-2">
                    Connect Your Email Account
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                    Choose your email provider below to sync your messages, calendar contacts, and keep your communication consolidated in one secure place.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
                {/* Gmail Integration Card */}
                <div className="flex flex-col p-6 bg-white dark:bg-slate-800/45 rounded-2xl border shadow-sm transition-all duration-200 border-slate-200/80 dark:border-slate-755/40 hover:border-slate-300 dark:hover:border-slate-600">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-900/60 flex items-center justify-center flex-shrink-0 shadow-sm border border-slate-100 dark:border-slate-800">
                            <svg className="w-6 h-6" viewBox="52 42 88 66">
                                <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
                                <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
                                <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
                                <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
                                <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Google Gmail</h3>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Secure Sync</span>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 flex-grow leading-relaxed">
                        Authorize KLIAS to securely sync and display your Gmail messages, compose replies, and search your inbox.
                    </p>
                    <button
                        onClick={handleConnectGmail}
                        className="w-full py-2 text-xs font-bold rounded-xl transition-all border text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60 active:scale-98"
                    >
                        Connect Gmail
                    </button>
                </div>

                {/* Microsoft Outlook Integration Card */}
                <div className="flex flex-col p-6 bg-white dark:bg-slate-800/40 rounded-2xl border shadow-sm transition-all duration-200 border-slate-200/80 dark:border-slate-700/40 hover:border-slate-300 dark:hover:border-slate-600">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-900/60 flex items-center justify-center flex-shrink-0 shadow-sm border border-slate-100 dark:border-slate-800">
                            <svg className="w-6 h-6" viewBox="0 0 512 512">
                                <rect width="231" height="270" x="168" y="107" fill="#05a" rx="3%" />
                                <path fill="#136" d="M398 247v23l15-8s0-7-5-9l-10-6zm-230 43v70h77v-70h-77z" />
                                <path fill="#17d" d="M168 150v70h77v-70h-77zm77 70v70h77v-70h-77zm77 70v70h77v-70h-77z" />
                                <path fill="#3ae" d="M245 150v70h77v-70h-77zm77 70v70h77v-70h-77z" />
                                <path fill="#5cf" d="M322 150h77v70h-77z" />
                                <path fill="#19e" d="M413 261 282 336s121 73 124 71c5-3 7-11 7-18V261Z" />
                                <path fill="#2ae" d="M160 266c-4 3-6 7-6 12v117c0 8 6 14 14 14h230c4 0 5 0 8-2" />
                                <rect width="172" height="172" x="70" y="172" fill="#18e" rx="3%" />
                                <path fill="#fff" d="M155 230c14 0 22 11 22 29s-9 28-23 28c-11 0-22-10-22-28 0-15 7-29 23-29Zm-1 75c26 0 44-18 44-47 0-25-16-46-43-46-28 0-44 20-44 48 0 27 20 45 43 45Z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Microsoft Outlook</h3>
                            <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider block">Secure Sync</span>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 flex-grow leading-relaxed">
                        Connect your Outlook or Microsoft 365 student account to synchronize all your student mails effortlessly.
                    </p>
                    <button
                        onClick={handleConnectOutlook}
                        className="w-full py-2 text-xs font-bold rounded-xl transition-all border text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60 active:scale-98"
                    >
                        Connect Outlook
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-1.5 mt-10 text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-wider">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                End-to-End Encrypted Authentication
            </div>
        </div>
    );

    const isCollapsed = false;

    const SidebarContent = () => (
        <div className="flex flex-col space-y-4 flex-grow pt-2 transition-all duration-300">
            {isCollapsed ? (
                <button
                    onClick={() => { setComposeState('normal'); setIsMobileMenuOpen(false); }}
                    className="h-10 w-10 rounded-full bg-red-600 flex items-center justify-center text-white hover:bg-red-700 transition-colors mx-auto shadow-md"
                    title="Compose Email"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" />
                    </svg>
                </button>
            ) : (
                <Button onClick={() => { setComposeState('normal'); setIsMobileMenuOpen(false); }} className="w-full">
                    Compose
                </Button>
            )}

            <div className="flex flex-col space-y-1">
                <button
                    onClick={() => { setActiveFolder('inbox'); setSelectedEmail(null); setIsMobileMenuOpen(false); }}
                    className={folderButtonClasses('inbox')}
                    title="Inbox"
                >
                    <div className="flex items-center gap-3 justify-start">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                        {!isCollapsed && <span className="truncate">Inbox</span>}
                    </div>
                </button>

                <button
                    onClick={() => { setActiveFolder('sent'); setSelectedEmail(null); setIsMobileMenuOpen(false); }}
                    className={folderButtonClasses('sent')}
                    title="Sent"
                >
                    <div className="flex items-center gap-3 justify-start">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                        {!isCollapsed && <span className="truncate">Sent</span>}
                    </div>
                </button>

                <button
                    onClick={() => { setActiveFolder('trash'); setSelectedEmail(null); setIsMobileMenuOpen(false); }}
                    className={folderButtonClasses('trash')}
                    title="Trash"
                >
                    <div className="flex items-center gap-3 justify-start">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {!isCollapsed && <span className="truncate">Trash</span>}
                    </div>
                </button>
            </div>

            <div className="flex-grow"></div>

            {/* Google / Outlook Sync integration */}
            {gmailStatus.connected && (
                <div className={`border-t border-slate-250 dark:border-slate-800 pt-4 ${isCollapsed ? 'flex justify-center' : ''}`}>
                    {isCollapsed ? (
                        <span className="relative flex h-3 w-3" title={`${gmailStatus.provider === 'outlook' ? 'Outlook' : gmailStatus.provider === 'campus' ? 'Campus' : 'Gmail'} Sync Connected`}>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                    ) : (
                        <div>
                            <h3 className="text-[10px] font-bold uppercase text-slate-405 mb-2 tracking-wider">
                                {gmailStatus.provider === 'outlook' ? 'Outlook Sync' : gmailStatus.provider === 'campus' ? 'Campus Sync' : 'Google Sync'}
                            </h3>
                            <div className="p-3 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/50 dark:border-slate-700/50 flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Connected
                                    </span>
                                    <button
                                        onClick={handleDisconnectGmail}
                                        className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        Disconnect
                                    </button>
                                </div>
                                <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium truncate block" title={gmailStatus.email}>
                                    {gmailStatus.email}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}


        </div>
    );

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-slate-900 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile Menu */}
                <div className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ${isMobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
                    <aside className={`absolute top-0 left-0 h-full w-full max-w-[270px] p-5 bg-white dark:bg-slate-900 flex-col flex shadow-2xl transition-transform duration-300 ease-in-out overflow-y-auto ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-2xl font-bold py-4 bg-clip-text text-transparent bg-gradient-to-r from-brand-gradient-from to-brand-gradient-to">
                                KLIAS Mailbox
                            </div>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <SidebarContent />
                    </aside>
                </div>

                {/* Mobile Header */}
                <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 h-14 px-4 flex md:hidden items-center justify-between">
                    {!isSearchActive ? (
                        <>
                            <div className="flex items-center gap-3 min-w-0">
                                <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">Mailbox</h1>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setIsSearchActive(true)} className="p-2 text-slate-600 dark:text-slate-300">
                                    {React.cloneElement(ICONS.search, { className: "h-6 w-6" })}
                                </button>
                                <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 dark:text-slate-300">
                                    <HamburgerIcon />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-2 w-full">
                            <button onClick={() => { setIsSearchActive(false); setSearchTerm(''); }} className="p-2 -ml-2 text-slate-600 dark:text-slate-300">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <Input
                                placeholder="Search mail"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex-1"
                                autoFocus
                            />
                        </div>
                    )}
                </header>
                <div className="h-14 md:hidden"></div>

                <div className="flex-1 flex flex-row min-w-0 bg-white dark:bg-slate-900 overflow-hidden">
                    {/* Sidebar container with dynamic collapse width */}
                    <aside className={`p-4 border-r border-slate-205 dark:border-slate-800 flex-col hidden md:flex bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 transition-all duration-300 ease-in-out overflow-y-auto scrollbar-hide ${isCollapsed ? 'w-[68px]' : 'w-[260px]'}`}>
                        <SidebarContent />
                    </aside>

                    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900">
                        {!gmailStatus.connected ? (
                            <GmailOnboarding />
                        ) : selectedEmail ? (
                            /* Premium white container-less unified detail view */
                            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 overflow-hidden">
                                {/* Header / Toolbar */}
                                <div className="px-6 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between h-[73px] flex-shrink-0">
                                    <button
                                        onClick={() => { setSelectedEmail(null); setReplyContent(''); }}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-305 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                        Back to Inbox
                                    </button>

                                    <div className="flex items-center gap-1.5">
                                        {activeFolder === 'inbox' && (
                                            <button
                                                title="Move to Trash"
                                                onClick={() => handleMoveToTrash(selectedEmail.id)}
                                                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400 transition-colors"
                                            >
                                                <TrashActionIcon />
                                            </button>
                                        )}
                                        {activeFolder === 'sent' && (
                                            <button
                                                title="Delete Permanently"
                                                onClick={() => handleDeletePermanently(selectedEmail.id)}
                                                className="p-2 rounded-lg border border-red-100 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                            >
                                                <TrashActionIcon />
                                            </button>
                                        )}
                                        {activeFolder === 'trash' && (
                                            <>
                                                <button
                                                    title="Move to Inbox"
                                                    onClick={() => handleRestoreFromTrash(selectedEmail.id)}
                                                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-105 dark:hover:bg-slate-800 transition-colors"
                                                >
                                                    <RestoreActionIcon />
                                                </button>
                                                <button
                                                    title="Delete Permanently"
                                                    onClick={() => handleDeletePermanently(selectedEmail.id)}
                                                    className="p-2 rounded-lg border border-red-100 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                                >
                                                    <TrashActionIcon />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Detail Content (Direct on white area) */}
                                <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                                            {selectedEmail.subject}
                                        </h2>
                                    </div>

                                    {/* Sender Details */}
                                    {(() => {
                                        const isSentFolder = activeFolder === 'sent';
                                        const partyToShow = isSentFolder ? (selectedEmail.recipient || selectedEmail.sender) : (selectedEmail.sender || selectedEmail.recipient);
                                        const nameToShow = isSentFolder ? `To: ${partyToShow?.name || 'Unknown'}` : (partyToShow?.name || 'Unknown');

                                        if (!partyToShow) return null;

                                        return (
                                            <div className="flex items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                                                <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg ${partyToShow.color || 'bg-slate-200 text-slate-700'}`}>
                                                    {partyToShow.initial || '?'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{nameToShow}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{partyToShow.email || ''}</p>
                                                </div>
                                                <p className="ml-auto text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">{formatTimestamp(selectedEmail.timestamp)}</p>
                                            </div>
                                        );
                                    })()}

                                    {/* Email Body - Rendered directly on white, no card/grey containers */}
                                    <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap select-text">
                                        {selectedEmail.body && (selectedEmail.body.includes('<html') || selectedEmail.body.includes('<body') || selectedEmail.body.includes('<table') || selectedEmail.body.includes('<div')) ? (
                                            <iframe
                                                ref={iframeRef}
                                                onLoad={adjustIframeHeight}
                                                srcDoc={`
                                                    <!DOCTYPE html>
                                                    <html>
                                                    <head>
                                                        <meta charset="utf-8">
                                                        <style>
                                                            body {
                                                                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                                                                font-size: 14px;
                                                                line-height: 1.6;
                                                                color: #334155;
                                                                margin: 0;
                                                                padding: 0;
                                                                background-color: #ffffff;
                                                            }
                                                            @media (prefers-color-scheme: dark) {
                                                                body {
                                                                    color: #e2e8f0;
                                                                    background-color: #0f172a;
                                                                }
                                                            }
                                                            img {
                                                                max-width: 100% !important;
                                                                height: auto !important;
                                                            }
                                                        </style>
                                                    </head>
                                                    <body>
                                                        ${selectedEmail.body}
                                                    </body>
                                                    </html>
                                                `}
                                                title="Email Content"
                                                sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                                                className="w-full border-0 bg-transparent transition-all duration-200"
                                                style={{ height: '500px' }}
                                            />
                                        ) : (
                                            <p className="whitespace-pre-wrap leading-relaxed text-sm text-slate-700 dark:text-slate-300 pr-2">
                                                {selectedEmail.body}
                                            </p>
                                        )}
                                    </div>

                                    {/* Shared Post Card */}
                                    {selectedEmail.type === 'post' && selectedEmail.postData && (
                                        <div className="mt-4">
                                            <SharedPostCard
                                                post={selectedEmail.postData}
                                                message={selectedEmail.optionalMessage}
                                            />
                                        </div>
                                    )}

                                    {/* Reply Form */}
                                    {activeFolder === 'inbox' && (
                                        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider">Reply</h3>
                                            <div className="flex items-center gap-1 mb-1 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200/60 dark:border-slate-800">
                                                <button
                                                    type="button"
                                                    onClick={() => handleFormatReply('bold')}
                                                    className="px-3 py-1 text-xs font-bold rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                                                    aria-label="Bold"
                                                >
                                                    B
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleFormatReply('italic')}
                                                    className="px-3 py-1 text-xs italic font-serif rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                                                    aria-label="Italic"
                                                >
                                                    I
                                                </button>
                                            </div>
                                            <textarea
                                                ref={replyTextareaRef}
                                                value={replyContent}
                                                onChange={(e) => setReplyContent(e.target.value)}
                                                maxLength={MAX_REPLY_LENGTH}
                                                rows={5}
                                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-705 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent dark:text-slate-200 resize-vertical text-sm"
                                                placeholder={`Reply to ${selectedEmail.sender?.name || selectedEmail.recipient?.name || 'Sender'}...`}
                                            />
                                            <div className="flex items-center justify-between mt-2">
                                                <span className={`text-[10px] ${replyContent.length > MAX_REPLY_LENGTH ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                                                    {replyContent.length} / {MAX_REPLY_LENGTH}
                                                </span>
                                                <Button onClick={handleSendReply} disabled={!replyContent.trim()}>
                                                    Send Reply
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Email List View */
                            <div className="flex-grow flex flex-col min-w-0 bg-white dark:bg-slate-900 overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 hidden md:flex items-center gap-4 h-[73px]">
                                    <div className="flex-grow">
                                        <Input
                                            placeholder="Search by subject or sender..."
                                            icon={SearchIcon}
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    {activeFolder === 'inbox' && <FilterButtons />}
                                </div>
                                <div className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-700/50 md:hidden">
                                    {activeFolder === 'inbox' && <FilterButtons />}
                                </div>

                                <main className="flex-1 overflow-y-auto" onScroll={handleScroll}>
                                    {loading && filteredEmails.length === 0 ? (
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800/50 animate-pulse">
                                            {[1, 2, 3, 4, 5, 6].map(i => (
                                                <div key={i} className="p-4 flex items-start space-x-4">
                                                    <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-full flex-shrink-0" />
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex justify-between items-center">
                                                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
                                                            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-12" />
                                                        </div>
                                                        <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                                                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : filteredEmails.length > 0 ? (
                                        <ul className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                            {filteredEmails.map(email => (
                                                <EmailListItem
                                                    key={email.id}
                                                    email={email}
                                                    onClick={() => {
                                                        if (activeFolder === 'inbox' && !email.isRead) {
                                                            handleMarkAsRead(email);
                                                        } else {
                                                            setSelectedEmail(email);
                                                        }
                                                    }}
                                                    activeFolder={activeFolder}
                                                />
                                            ))}
                                            {loadingMore && (
                                                <div className="p-4 flex items-start space-x-4 animate-pulse border-t border-slate-100 dark:border-slate-800/50">
                                                    <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-full flex-shrink-0" />
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex justify-between items-center">
                                                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
                                                            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-12" />
                                                        </div>
                                                        <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                                                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
                                                    </div>
                                                </div>
                                            )}
                                        </ul>
                                    ) : (
                                        <div className="text-center p-8 text-slate-500 dark:text-slate-400">
                                            <p>No emails found.</p>
                                        </div>
                                    )}
                                </main>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={() => setComposeState('normal')}
                    className="md:hidden fixed bottom-24 right-6 h-14 w-14 bg-gradient-to-r from-brand-gradient-from to-brand-gradient-to rounded-2xl flex items-center justify-center text-white shadow-lg z-20"
                    aria-label="Compose new email"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" />
                    </svg>
                </button>

                {composeState !== 'closed' && (
                    <ComposeMail
                        windowState={composeState}
                        onSend={handleSendEmail}
                        onClose={() => setComposeState('closed')}
                        onWindowStateChange={setComposeState}
                    />
                )}
            </div>

            <PremiumModal
                isOpen={modal.isOpen}
                title={modal.title}
                message={modal.message}
                type={modal.type}
                onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={modal.onConfirm}
            />
        </div>
    );
};

// Premium Custom Modal Component for a polished experience!
const PremiumModal: React.FC<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onClose: () => void;
    onConfirm?: () => void;
}> = ({ isOpen, title, message, type, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl z-10 max-w-sm w-full transition-all scale-100 animate-in fade-in zoom-in-95 duration-200">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">{message}</p>
                <div className="flex justify-end gap-3">
                    {type === 'confirm' && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={() => {
                            onClose();
                            if (onConfirm) onConfirm();
                        }}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors ${type === 'confirm' ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100'}`}
                    >
                        {type === 'confirm' ? 'Confirm' : 'OK'}
                    </button>
                </div>
            </div>
        </div>
    );
};