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
    
    return (
        <li onClick={onClick} className="flex items-start gap-4 p-4 border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 cursor-pointer transition-colors duration-150">
            <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg ${partyToShow.color}`}>
                {partyToShow.initial}
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
}

export const MailboxPage: React.FC = () => {
    const { user } = useAuth();
    const { messages: contextMessages, conversations } = useMessages();
    
    const [inboxEmails, setInboxEmails] = useState<Email[]>([]);
    const [sentEmails, setSentEmails] = useState<Email[]>([]);
    const [trashedEmails, setTrashedEmails] = useState<Email[]>([]);
    
    const [activeFolder, setActiveFolder] = useState<ActiveFolder>('inbox');
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
    
    const [composeState, setComposeState] = useState<ComposeWindowState>('closed');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSearchActive, setIsSearchActive] = useState(false);

    const [replyContent, setReplyContent] = useState('');
    const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
    const MAX_REPLY_LENGTH = 1000;
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Fetch emails from API
    const fetchEmails = async () => {
        try {
            setLoading(true);
            const inbox = await emailsAPI.getInbox();
            const sent = await emailsAPI.getSent();
            const trash = await emailsAPI.getTrash();
            
            setInboxEmails(inbox);
            setSentEmails(sent);
            setTrashedEmails(trash);
        } catch (err) {
            console.error('Failed to fetch emails:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmails();
    }, [user]);

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
            })
            .filter(email => {
                const term = searchTerm.toLowerCase();
                if (!term) return true;
                const searchParty = activeFolder === 'sent' ? email.recipient : email.sender;
                return email.subject.toLowerCase().includes(term) ||
                       searchParty.name.toLowerCase().includes(term);
            });
    }, [searchTerm, filter, activeFolder, inboxEmails, sentEmails, trashedEmails]);

    const handleSendEmail = async (data: ComposeMailData) => {
        if (!user) return;
        try {
            const allRecipients = [...data.to, ...data.cc, ...data.bcc];
            await emailsAPI.sendEmail({
                to: data.to,
                cc: data.cc,
                bcc: data.bcc,
                subject: data.subject,
                body: data.body
            });

            // Refresh emails after sending
            fetchEmails();
            setComposeState('closed');
        } catch (err) {
            console.error('Failed to send email:', err);
            alert('Failed to send email. Make sure the recipient email is a registered user.');
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

    const handleSendReply = () => {
        if (!user || !selectedEmail || !replyContent.trim()) return;

        const newReplyEmail: Email = {
            id: `sent-${Date.now()}`,
            sender: {
                name: user.name,
                email: user.email,
                initial: user.name.charAt(0).toUpperCase(),
                color: 'bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-200'
            },
            recipient: selectedEmail.sender,
            subject: selectedEmail.subject.startsWith('Re: ') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
            preview: replyContent.substring(0, 100) + '...',
            body: replyContent,
            timestamp: new Date().toISOString(),
            isRead: true,
        };

        setSentEmails([newReplyEmail, ...sentEmails]);
        setSelectedEmail(null);
        setReplyContent('');
    };

    const handleMarkAsRead = async (email: Email) => {
        try {
            await emailsAPI.markAsRead(email.id);
            // Update local state
            setInboxEmails(prev =>
                prev.map(e => e.id === email.id ? { ...e, isRead: true } : e)
            );
            setSelectedEmail({ ...email, isRead: true });
        } catch (err) {
            console.error('Failed to mark as read:', err);
            setSelectedEmail(email);
        }
    };
    
    const handleMoveToTrash = async (emailId: string) => {
        try {
            await emailsAPI.deleteEmail(emailId);
            fetchEmails(); // Refresh all folders
            setSelectedEmail(null);
        } catch (err) {
            console.error('Failed to move to trash:', err);
        }
    };

    const handleDeletePermanently = (emailId: string) => {
        if (window.confirm('Are you sure you want to delete this email permanently? This action cannot be undone.')) {
            if (activeFolder === 'sent') {
                setSentEmails(sentEmails.filter(e => e.id !== emailId));
            } else if (activeFolder === 'trash') {
                setTrashedEmails(trashedEmails.filter(e => e.id !== emailId));
            }
            setSelectedEmail(null);
        }
    };

    const handleRestoreFromTrash = (emailId: string) => {
        const emailToRestore = trashedEmails.find(e => e.id === emailId);
        if (emailToRestore) {
            setTrashedEmails(trashedEmails.filter(e => e.id !== emailId));
            setInboxEmails([emailToRestore, ...inboxEmails]);
            setSelectedEmail(null);
        }
    };

    if (!user) return null;

    const folderButtonClasses = (folder: ActiveFolder) => 
        `px-4 py-2 text-left rounded-md transition-colors w-full ${
            activeFolder === folder
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

    const SidebarContent = () => (
         <div className="flex flex-col space-y-4 flex-grow pt-2">
            <Button onClick={() => { setComposeState('normal'); setIsMobileMenuOpen(false); }} className="w-full">
                Compose
            </Button>
            <div className="flex flex-col space-y-1">
                <button onClick={() => { setActiveFolder('inbox'); setIsMobileMenuOpen(false); }} className={folderButtonClasses('inbox')}>Inbox</button>
                <button onClick={() => { setActiveFolder('sent'); setIsMobileMenuOpen(false); }} className={folderButtonClasses('sent')}>Sent</button>
                <button onClick={() => { setActiveFolder('trash'); setIsMobileMenuOpen(false); }} className={folderButtonClasses('trash')}>Trash</button>
            </div>
            <div className="flex-grow"></div>
            <div>
                <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">Quick Access</h3>
                <nav className="flex flex-col space-y-1">
                    <button className="flex items-center px-3 py-2 text-slate-500 dark:text-slate-400 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <ContactsIcon /> Contacts
                    </button>
                    <button className="flex items-center px-3 py-2 text-slate-500 dark:text-slate-400 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <TrashIcon /> Empty Trash
                    </button>
                </nav>
            </div>
         </div>
    );

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-slate-900 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
             {/* Mobile Menu */}
            <div className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="absolute inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)}></div>
                <aside className={`absolute top-0 left-0 h-full w-[280px] p-5 bg-white dark:bg-slate-800 flex-col flex transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="text-2xl font-bold py-4 bg-clip-text text-transparent bg-gradient-to-r from-brand-gradient-from to-brand-gradient-to">
                        KLIAS Mailbox
                    </div>
                    <SidebarContent />
                </aside>
            </div>


            {/* New Mobile Header */}
            <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex md:hidden items-center justify-between">
                {!isSearchActive ? (
                    <>
                        <div className="flex items-center gap-3 min-w-0">
                            <button 
                                onClick={handleBack} 
                                className="p-2 -ml-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
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
            <div className="h-12 md:hidden"></div>

            <div className="flex-1 flex flex-row min-w-0 bg-white dark:bg-slate-900 overflow-hidden">
                <aside className="w-[260px] p-4 border-r border-slate-200 dark:border-slate-800 flex-col hidden md:flex bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
                    <SidebarContent />
                </aside>
                <div className="flex-1 flex flex-col min-w-0">
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
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 md:hidden">
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                            {activeFolder}
                        </h2>
                        {activeFolder === 'inbox' && <FilterButtons />}
                    </div>
                    <main className="flex-1 overflow-y-auto">
                        <ul>
                            {loading ? (
                                <div className="text-center p-8 text-slate-500 dark:text-slate-400">
                                    <p>Loading emails...</p>
                                </div>
                            ) : filteredEmails.length > 0 ? (
                                filteredEmails.map(email => (
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
                                ))
                            ) : (
                                <div className="text-center p-8 text-slate-500 dark:text-slate-400">
                                    <p>No emails found.</p>
                                </div>
                            )}
                        </ul>
                    </main>
                </div>
            </div>

            {selectedEmail && (
                <Modal isOpen={!!selectedEmail} onClose={() => { setSelectedEmail(null); setReplyContent(''); }} title="">
                    <div className="flex flex-col">
                        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">
                            <h2 className="text-xl font-semibold truncate pr-4">{selectedEmail.subject}</h2>
                             <div className="flex items-center gap-1 flex-shrink-0">
                                {activeFolder === 'inbox' && (
                                    <button title="Move to Trash" onClick={() => handleMoveToTrash(selectedEmail.id)} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                        <TrashActionIcon />
                                    </button>
                                )}
                                {activeFolder === 'sent' && (
                                    <button title="Delete Permanently" onClick={() => handleDeletePermanently(selectedEmail.id)} className="p-2 rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                                        <TrashActionIcon />
                                    </button>
                                )}
                                {activeFolder === 'trash' && (
                                    <>
                                        <button title="Move to Inbox" onClick={() => handleRestoreFromTrash(selectedEmail.id)} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                            <RestoreActionIcon />
                                        </button>
                                        <button title="Delete Permanently" onClick={() => handleDeletePermanently(selectedEmail.id)} className="p-2 rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                                            <TrashActionIcon />
                                        </button>
                                    </>
                                )}
                                <button onClick={() => { setSelectedEmail(null); setReplyContent(''); }} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ml-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="space-y-4 max-h-[calc(80vh-200px)] overflow-y-auto">
                            <div className="flex items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                                <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg ${selectedEmail.sender.color}`}>
                                    {selectedEmail.sender.initial}
                                </div>
                                <div>
                                    <p className="font-semibold">{selectedEmail.sender.name}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{selectedEmail.sender.email}</p>
                                </div>
                                <p className="ml-auto text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">{formatTimestamp(selectedEmail.timestamp)}</p>
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed text-sm text-slate-700 dark:text-slate-300 pr-2">
                                {selectedEmail.body}
                            </p>
                            {selectedEmail.type === 'post' && selectedEmail.postData && (
                                <div className="mt-4">
                                    <SharedPostCard 
                                        post={selectedEmail.postData} 
                                        message={selectedEmail.optionalMessage}
                                    />
                                </div>
                            )}
                            {activeFolder === 'inbox' && (
                                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <h3 className="text-md font-semibold mb-2">Reply</h3>
                                    <div className="flex items-center gap-1 mb-1 p-2 bg-slate-100 dark:bg-slate-900/50 rounded-md border border-slate-200 dark:border-slate-700">
                                        <button 
                                            type="button" 
                                            onClick={() => handleFormatReply('bold')} 
                                            className="px-3 py-1 text-sm font-bold rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                                            aria-label="Bold"
                                        >
                                            B
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => handleFormatReply('italic')} 
                                            className="px-3 py-1 text-sm italic font-serif rounded hover:bg-slate-200 dark:hover:bg-slate-700"
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
                                        className="w-full px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 border border-transparent focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent dark:text-slate-200 resize-vertical"
                                        placeholder={`Reply to ${selectedEmail.sender.name}...`}
                                    />
                                    <div className={`text-right text-xs mt-1 ${replyContent.length > MAX_REPLY_LENGTH ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                        {replyContent.length} / {MAX_REPLY_LENGTH}
                                    </div>
                                    <div className="flex justify-end mt-2">
                                        <Button onClick={handleSendReply} disabled={!replyContent.trim()}>
                                            Send Reply
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

             <button 
                onClick={() => setComposeState('normal')}
                className="md:hidden fixed bottom-24 right-6 h-14 w-14 bg-gradient-to-r from-brand-gradient-from to-brand-gradient-to rounded-2xl flex items-center justify-center text-white shadow-lg z-20"
                aria-label="Compose new email"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>
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
        </div>
    );
};