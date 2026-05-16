import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_BROADCASTS } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../contexts/SocketContext';
import { Role, Broadcast } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { BroadcastCard } from '../components/BroadcastCard';
import { announcementsAPI } from '../src/api/announcements';

// --- ICONS ---
const UsersIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
);
const StudentsIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147L12 14.654l7.74-4.507m-15.48 0a48.114 48.114 0 00-2.525-.879 59.79 59.79 0 0110.265-5.779 59.79 59.79 0 0110.265 5.779c-.83.273-1.672.566-2.525.879m-15.48 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.905 59.905 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0l-3.07-.812A59.905 59.905 0 0112 3.493a59.905 59.905 0 0110.399 5.84l-3.07.813M3.75 14.25v7.5m16.5-7.5v7.5" />
    </svg>
);
const TeachersIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

// --- HELPER COMPONENTS ---
const AudienceButton: React.FC<{
    label: string;
    icon: React.ReactElement<React.SVGProps<SVGSVGElement>>;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => {
    const baseClasses = "flex flex-col items-center justify-center gap-1 p-2 md:p-3 rounded-lg border-2 transition-all duration-200 w-full";
    const activeClasses = "bg-red-50 dark:bg-red-900/20 border-red-500 text-red-600 dark:text-red-400 font-semibold shadow-sm";
    const inactiveClasses = "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400";

    return (
        <button onClick={onClick} className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}>
            {React.cloneElement(icon, { className: "h-5 w-5" })}
            <span className="text-xs font-medium">{label}</span>
        </button>
    );
};


const AudienceBadge: React.FC<{ target: Role | 'All' }> = ({ target }) => {
    const styles: Record<Role | 'All', string> = {
        'All': 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
        [Role.STUDENT]: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
        [Role.TEACHER]: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
        [Role.ADMIN]: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
        [Role.DEAN]: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    };
    const label = target === 'All' ? 'All Users' : target;

    return (
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[target]}`}>
            {label}
        </span>
    );
};

const BroadcastSkeleton: React.FC = () => (
    <div className="p-4 mb-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse">
        <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full" />
            <div className="flex-1 space-y-3">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
            </div>
        </div>
    </div>
);


const BroadcastHistoryItem: React.FC<{ broadcast: Broadcast; currentUserId?: string; onDelete?: (id: string) => void }> = ({ broadcast, currentUserId, onDelete }) => {
    const isOwner = Boolean(
        (broadcast.author as any)?.id === currentUserId ||
        (broadcast.author as any)?._id === currentUserId
    );

    const handleDelete = () => {
        if (onDelete) {
            onDelete(broadcast.id);
        }
    };

    return (
        <div className="p-2.5 md:p-3 mb-2 bg-red-50 dark:bg-red-900/10 rounded-xl border-l-[3px] md:border-l-4 border-red-500 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-2 md:gap-3">
                {/* Icon */}
                <div className="flex-shrink-0 w-7 h-7 md:w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <UsersIcon className="w-3.5 h-3.5 md:w-4 h-4 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Title */}
                    <h3 className="font-bold text-sm md:text-base text-slate-900 dark:text-slate-100 truncate">
                        {broadcast.title}
                    </h3>

                    {/* Description */}
                    <p className="text-[11px] md:text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2 leading-tight">
                        {broadcast.content}
                    </p>

                    {/* Sender & Target */}
                    <div className="flex items-center justify-between mt-2 text-[10px] md:text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1">
                            <span className="font-medium">By {broadcast.author.name}</span>
                            <span>•</span>
                            <span>{new Date(broadcast.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-2">
                            <AudienceBadge target={broadcast.target} />
                            {isOwner && onDelete && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="px-1.5 py-0.5 text-[10px] md:text-xs font-semibold text-red-600 hover:text-white hover:bg-red-500 rounded border border-red-200 transition"
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN PAGE COMPONENT ---
export const BroadcastPage: React.FC = () => {
    const { user } = useAuth();
    const { socket } = useSocket();
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [target, setTarget] = useState<Role | 'All'>('All');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
    const navigate = useNavigate();

    // Fetch announcements on mount
    useEffect(() => {
        fetchBroadcasts();

        if (socket) {
            socket.on('announcement-created', (newAnnouncement) => {
                const authorId = newAnnouncement.author?.id || newAnnouncement.author?._id || newAnnouncement.author_id;
                const currentUserId = user?.id || user?._id;

                // Only add to history if it's our broadcast (matches mount filter)
                if (String(authorId) !== String(currentUserId)) return;

                const newBroadcast: Broadcast = {
                    id: newAnnouncement.id || newAnnouncement._id,
                    title: newAnnouncement.title,
                    content: newAnnouncement.content,
                    author: newAnnouncement.author,
                    target: newAnnouncement.target,
                    timestamp: newAnnouncement.createdAt || newAnnouncement.created_at,
                };

                setBroadcasts(prev => {
                    if (prev.some(b => String(b.id) === String(newBroadcast.id))) {
                        return prev;
                    }
                    return [newBroadcast, ...prev];
                });
            });

            return () => {
                socket.off('announcement-created');
            };
        }
    }, [socket]);

    const fetchBroadcasts = async () => {
        try {
            setLoading(true);
            const data = await announcementsAPI.getAnnouncements();
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const broadcastsFromAPI: Broadcast[] = data.map((ann: any) => ({
                id: String(ann.id || ann._id),
                title: ann.title,
                content: ann.content,
                author: ann.author,
                target: ann.target,
                timestamp: ann.createdAt || ann.created_at,
            }));
            const filtered = broadcastsFromAPI
                .filter(b => new Date(b.timestamp).getTime() >= sevenDaysAgo)
                .filter(b => String((b.author as any)?.id || (b.author as any)?._id) === String(user?.id || user?._id))
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setBroadcasts(filtered);
        } catch (err) {
            console.error('Failed to load broadcasts:', err);
            setError('Failed to load broadcasts');
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            navigate('/home', { replace: true });
        }
    };

    const clearForm = () => {
        setTitle('');
        setContent('');
        setTarget('All');
        setError('');
    }

    const mapRoleToTarget = (role: Role | 'All'): string => {
        if (role === 'All') return 'All';
        if (role === Role.STUDENT) return 'Student';
        if (role === Role.TEACHER) return 'Teacher';
        return 'All';
    };

    const handleSendBroadcast = async () => {
        if (!title.trim() || !content.trim() || !user) return;
        try {
            setIsSubmitting(true);
            setError('');
            // Map frontend role to backend target
            const backendTarget = mapRoleToTarget(target);
            // Save to database
            const newAnnouncement = await announcementsAPI.createAnnouncement({
                title,
                content,
                target: backendTarget
            });
            // Emit socket event (UI will update via socket event only)
            if (socket) {
                socket.emit('new-announcement', newAnnouncement);
            }
            clearForm();
            setIsPreviewOpen(false);
        } catch (err) {
            setError('Failed to send broadcast. Please try again.');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteBroadcast = async (announcementId: string) => {
        setDeleteModal({ open: true, id: announcementId });
    };

    const confirmDeleteBroadcast = async () => {
        if (!deleteModal.id) return;
        try {
            await announcementsAPI.deleteAnnouncement(deleteModal.id);
            setBroadcasts(prev => prev.filter(b => String(b.id) !== String(deleteModal.id)));
            setDeleteModal({ open: false, id: null });
        } catch (err) {
            console.error('Failed to delete broadcast:', err);
            setError('Failed to delete broadcast.');
            setDeleteModal({ open: false, id: null });
        }
    };

    const isFormIncomplete = !title.trim() || !content.trim();

    return (
        <div className="min-h-screen bg-slate-50 flex justify-center">
            <div className="w-[98%] max-w-[1600px] mx-auto pb-8">
                <header className="flex md:hidden items-center gap-3 px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 mb-6">
                    <button 
                        onClick={handleBack} 
                        className="p-2 -ml-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">Create Broadcast</h1>
                </header>
                <div className="hidden md:flex items-center gap-4 px-4 md:px-8 pt-6 mb-6">
                    <button 
                        onClick={handleBack} 
                        className="p-2 -ml-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Create Broadcast</h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 px-5 md:px-8">
                    {/* --- CREATE BROADCAST --- */}
                    <div className="lg:col-span-2">
                        <Card className="p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 min-h-auto lg:h-[540px] flex flex-col bg-white dark:bg-slate-900 transition-all">
                            <div className="space-y-2 md:space-y-3">
                                <div>
                                    <label htmlFor="broadcast-title" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Title</label>
                                    <Input
                                        id="broadcast-title"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g., Campus Closure Notice"
                                        disabled={isSubmitting}
                                        className="text-sm"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="broadcast-message" className="block text-[11px] md:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2 uppercase tracking-wide">Message</label>
                                    <textarea
                                        id="broadcast-message"
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        className="w-full p-3 text-sm bg-slate-100 dark:bg-slate-700 rounded-lg border border-transparent focus:outline-none focus:ring-2 focus:ring-red-500 resize-none transition placeholder:text-slate-400 disabled:opacity-50 min-h-[140px] md:min-h-[200px]"
                                        rows={4}
                                        placeholder="Write your announcement here..."
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Target Audience</label>
                                    <div className="grid grid-cols-3 gap-2.5">
                                        <AudienceButton label="All Users" icon={<UsersIcon />} isActive={target === 'All'} onClick={() => !isSubmitting && setTarget('All')} />
                                        <AudienceButton label="Students" icon={<StudentsIcon />} isActive={target === Role.STUDENT} onClick={() => !isSubmitting && setTarget(Role.STUDENT)} />
                                        <AudienceButton label="Teachers" icon={<TeachersIcon />} isActive={target === Role.TEACHER} onClick={() => !isSubmitting && setTarget(Role.TEACHER)} />
                                    </div>
                                </div>
                                {error && (
                                    <div className="p-2.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-xs">
                                        {error}
                                    </div>
                                )}
                                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700 mt-auto">
                                    <Button variant="ghost" onClick={() => setIsPreviewOpen(true)} disabled={isFormIncomplete || isSubmitting} className="text-base font-semibold">Preview</Button>
                                    <Button onClick={handleSendBroadcast} disabled={isFormIncomplete || isSubmitting} className="text-base font-semibold">
                                        {isSubmitting ? 'Sending...' : 'Send'}
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* --- BROADCAST HISTORY --- */}
                    <div className="lg:col-span-3">
                        <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">Broadcast History</h2>
                        <div className="flex flex-col space-y-4 max-h-[540px] overflow-y-auto scrollbar-hide">
                            {loading && (
                                <>
                                    {[1, 2, 3, 4].map((i) => (
                                        <BroadcastSkeleton key={`broadcast-skeleton-${i}`} />
                                    ))}
                                </>
                            )}

                            {!loading && broadcasts.length > 0 && (
                                broadcasts.map(b => (
                                    <BroadcastHistoryItem
                                        key={`broadcast-${b.id}`}
                                        broadcast={b}
                                        currentUserId={user?.id || user?._id}
                                        onDelete={handleDeleteBroadcast}
                                    />
                                ))
                            )}
                            {!loading && broadcasts.length === 0 && (
                                <div className="text-center py-20 text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                    <p>No past broadcasts.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- DELETE CONFIRMATION MODAL --- */}
                <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, id: null })} title="Delete Broadcast?">
                    <p className="mb-4">Are you sure you want to delete this broadcast? This action cannot be undone.</p>
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setDeleteModal({ open: false, id: null })}>Cancel</Button>
                        <Button variant="danger" onClick={confirmDeleteBroadcast}>Delete</Button>
                    </div>
                </Modal>

                {/* --- PREVIEW MODAL --- */}
                <Modal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} title="Broadcast Preview">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">This is how your broadcast will appear in the main feed.</p>
                    {user && (
                        <BroadcastCard
                            broadcast={{
                                id: 'preview-id',
                                title: title,
                                content: content,
                                author: user,
                                target: target,
                                timestamp: new Date().toISOString(),
                            }}
                            isPinned={true}
                        />
                    )}
                    <div className="flex justify-end mt-4">
                        <Button variant="secondary" onClick={() => setIsPreviewOpen(false)}>Close Preview</Button>
                    </div>
                </Modal>
            </div>
        </div>
    );
};
