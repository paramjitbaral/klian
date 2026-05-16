import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_GROUPS, USERS, ICONS } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { Avatar } from '../components/ui/Avatar';
import { MessageBubble } from '../components/MessageBubble';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { User, Group, GroupMessage } from '../types';
import { ChatInput } from '../components/ChatInput';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { usersAPI } from '../src/api/users';
import { groupsAPI } from '../src/api/groups';
import { useSocket } from '../contexts/SocketContext';
import { useMessages } from '../contexts/MessagesContext';

const AddGroupMembersModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAddMembers: (newMembers: User[]) => void;
    group: Group;
    allUsers: User[];
}> = ({ isOpen, onClose, onAddMembers, group, allUsers }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

    useEffect(() => {
        if (!isOpen) {
            setSearchTerm('');
            setSelectedUsers([]);
        }
    }, [isOpen]);

    const existingMemberIds = new Set((group.members || []).map(m => {
        const memberObj = (m as any).user || m;
        return String(memberObj._id || memberObj.id || memberObj.uid || memberObj);
    }));

    const usersAvailableToAdd = (allUsers || []).filter(user => {
        const userId = String((user as any)._id || user.id || (user as any).uid || user);
        const name = user.name || 'User';
        const email = (user as any).email || '';
        const username = user.username || email.split('@')[0] || userId.slice(-4);

        return !existingMemberIds.has(userId) &&
            (name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                email.toLowerCase().includes(searchTerm.toLowerCase()));
    });

    const handleToggleUser = (user: User) => {
        const userId = String((user as any)._id || user.id || (user as any).uid || user);
        setSelectedUsers(prev => {
            const isSelected = prev.some(u => String((u as any)._id || u.id || (u as any).uid || u) === userId);
            if (isSelected) {
                return prev.filter(u => String((u as any)._id || u.id || (u as any).uid || u) !== userId);
            } else {
                return [...prev, user];
            }
        });
    };

    const handleAdd = () => {
        onAddMembers(selectedUsers);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Add Members to ${group.name}`}>
            <div className="space-y-4">
                <Input
                    placeholder="Search for users..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    icon={React.cloneElement(ICONS.search, { className: 'h-5 w-5' })}
                    className="!bg-white dark:!bg-slate-800 !border-slate-100 dark:!border-slate-700 !rounded-xl focus:!ring-1 focus:!ring-slate-200 dark:focus:!ring-slate-700 !transition-all"
                />
                <div className="max-h-60 overflow-y-auto space-y-1 p-1 bg-white dark:bg-slate-800 rounded-md scrollbar-hide border border-slate-100 dark:border-slate-700">
                    {usersAvailableToAdd.length > 0 ? usersAvailableToAdd.map(user => {
                        const userId = String((user as any)._id || user.id || (user as any).uid || user);
                        const avatar = user.profilePicture || user.avatar || (user as any).avatarUrl || (user as any).profilePic;
                        const name = user.name || 'User';
                        const username = user.username || (user as any).email?.split('@')[0] || userId.slice(-4);
                        const isSelected = selectedUsers.some(u => String((u as any)._id || u.id || (u as any).uid || u) === userId);

                        return (
                            <div
                                key={userId}
                                onClick={() => handleToggleUser(user)}
                                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                            >
                                <div className="flex items-center space-x-3">
                                    <Avatar src={avatar} alt={name} size="sm" />
                                    <div>
                                        <p className="font-semibold text-sm text-slate-900 dark:text-white">{name}</p>
                                        <p className="text-xs text-slate-500">@{username}</p>
                                    </div>
                                </div>
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-red-500 border-red-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                    {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                                </div>
                            </div>
                        );
                    }) : (
                        <p className="text-center text-sm text-slate-500 py-4">No users found.</p>
                    )}
                </div>
                <div className="flex justify-end pt-2">
                    <Button onClick={handleAdd} disabled={selectedUsers.length === 0} className="rounded-xl px-8">
                        Add {selectedUsers.length > 0 ? `(${selectedUsers.length})` : 'Member(s)'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

const GroupMembersModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    members: User[];
    allUsers: User[];
    currentUser: User;
    isAdmin: boolean;
    onAddMemberClick: () => void;
}> = ({ isOpen, onClose, members, allUsers, currentUser, isAdmin, onAddMemberClick }) => {
    const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());

    const handleFollowToggle = (userId: string) => {
        setFollowedUsers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return newSet;
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Group Members">
            {isAdmin && (
                <div className="mb-4">
                    <Button onClick={onAddMemberClick} className="w-full flex items-center justify-center gap-2">
                        {ICONS.plus}
                        Add Member
                    </Button>
                </div>
            )}
            <div className="space-y-4 max-h-96 overflow-y-auto scrollbar-hide">
                {(members || []).map(m => {
                    const memberObj = (m as any).user || m;
                    const memberId = String(memberObj._id || memberObj.id || memberObj.uid || memberObj);
                    const fullMember = allUsers.find(u =>
                        String(u.id) === memberId ||
                        String((u as any)._id) === memberId ||
                        String((u as any).uid) === memberId
                    ) || memberObj;

                    const isFollowing = followedUsers.has(memberId);

                    // Comprehensive avatar check
                    const avatar = fullMember.profilePicture || fullMember.avatar || (fullMember as any).avatarUrl || (fullMember as any).profilePic ||
                        memberObj.profilePicture || memberObj.avatar || (memberObj as any).avatarUrl || (memberObj as any).profilePic;

                    const name = fullMember.name || memberObj.name || 'User';
                    const username = fullMember.username || memberObj.username || (fullMember as any).email?.split('@')[0] || memberId.slice(-4);

                    return (
                        <div key={memberId} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <Avatar src={avatar} alt={name} />
                                <div className="flex-1">
                                    <p className="font-semibold text-sm text-slate-900 dark:text-white">
                                        {name} {memberId === currentUser.id && <span className="text-xs text-slate-500 font-normal ml-1">(You)</span>}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        @{username}
                                    </p>
                                </div>
                            </div>
                            {memberId !== currentUser.id && (
                                <Button
                                    variant={isFollowing ? 'ghost' : 'secondary'}
                                    className="!px-3 !py-1 !text-sm"
                                    onClick={() => handleFollowToggle(memberId)}
                                >
                                    {isFollowing ? 'Following' : 'Follow'}
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>
        </Modal>
    );
};

type GroupSettingsTab = 'General' | 'Members' | 'Danger Zone';
type NotificationSetting = 'all' | 'mentions' | 'off';

const GroupSettingsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    group: Group;
    allUsers: User[];
    currentUser: User;
    onUpdateGroup: (updatedGroup: Group) => void;
}> = ({ isOpen, onClose, group, allUsers, currentUser, onUpdateGroup }) => {
    const [activeTab, setActiveTab] = useState<GroupSettingsTab>('General');
    const [groupName, setGroupName] = useState(group.name);
    const [groupDescription, setGroupDescription] = useState(group.description || '');
    const [notificationSetting, setNotificationSetting] = useState<NotificationSetting>('all');
    const groupAdmins = (group.members || []).filter((m: any) => m.role === 'admin').map((m: any) => m.user?.id || m.id);
    const isAdmin = groupAdmins.includes(currentUser.id) || groupAdmins.includes(String(currentUser.id)) || group.admins?.includes(currentUser.id);

    const handleSaveChanges = async () => {
        const groupId = group.id || (group as any)._id;
        try {
            const res = await groupsAPI.updateNotificationSetting(String(groupId), notificationSetting);
            // Since updateNotificationSetting only returns the setting, we still need to merge
            // but for name/description updates we use the full response.
            onUpdateGroup({ ...group, name: groupName, description: groupDescription, notificationSetting });
            onClose();
        } catch (error) {
            console.error('Failed to update notification setting:', error);
            alert('Failed to save settings. Please try again.');
        }
    };

    const handleMemberAction = async (memberId: string, action: 'remove' | 'promote' | 'demote') => {
        const groupId = group.id || (group as any)._id;
        try {
            if (action === 'remove') {
                if (window.confirm('Are you sure you want to remove this member?')) {
                    const res = await groupsAPI.removeMember(String(groupId), memberId);
                    onUpdateGroup(res.data);
                }
            } else if (action === 'promote') {
                const res = await groupsAPI.updateMemberRole(String(groupId), memberId, 'admin');
                onUpdateGroup(res.data);
            } else if (action === 'demote') {
                const res = await groupsAPI.updateMemberRole(String(groupId), memberId, 'member');
                onUpdateGroup(res.data);
            }
        } catch (error) {
            console.error(`Failed to ${action} member:`, error);
            alert(`Failed to ${action} member. Please try again.`);
        }
    };

    const handleLeaveGroup = async () => {
        if (window.confirm('Are you sure you want to leave this group?')) {
            const groupId = group.id || (group as any)._id;
            try {
                await groupsAPI.leaveGroup(groupId);
                onClose();
                // We let the parent handle the navigation/state update
                if ((window as any).handleGroupLeave) {
                    (window as any).handleGroupLeave(groupId);
                }
            } catch (error) {
                console.error('Failed to leave group:', error);
                alert('Failed to leave group. Please try again.');
            }
        }
    };

    const handleDeleteGroup = () => {
        if (window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
            // In a real app, this would be a DELETE request. Here we'll simulate it.
            // A function would be needed at GroupsPage level to remove the group from the list.
            alert(`Group "${group.name}" has been deleted.`);
            onClose();
        }
    }


    const tabButtonClasses = (tab: GroupSettingsTab) =>
        `px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${activeTab === tab
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
        } uppercase tracking-wider`;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Group Settings">
            <div className="-mt-1.5 md:-mt-3 flex items-center justify-center gap-2 border-b border-slate-100 dark:border-slate-800 mb-6 pb-2">
                <button onClick={() => setActiveTab('General')} className={tabButtonClasses('General')}>General</button>
                <button onClick={() => setActiveTab('Members')} className={tabButtonClasses('Members')}>Members</button>
                <button onClick={() => setActiveTab('Danger Zone')} className={tabButtonClasses('Danger Zone')}>Danger Zone</button>
            </div>

            <div className="max-h-96 overflow-y-auto px-4 pr-2 scrollbar-hide">
                {activeTab === 'General' && (
                    <div className="space-y-4">
                        <Input label="Group Name" value={groupName} onChange={e => setGroupName(e.target.value)} disabled={!isAdmin} className="!bg-slate-50 dark:!bg-slate-800/50 !border-slate-100 dark:!border-slate-700 !rounded-lg focus:!ring-1 focus:!ring-slate-200 dark:focus:!ring-slate-700 !transition-all !text-xs" />
                        <div className="pt-1">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Description</label>
                            <textarea value={groupDescription} onChange={e => setGroupDescription(e.target.value)} rows={3} className="w-full p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-200 dark:focus:ring-slate-700 transition-all resize-none disabled:opacity-70 scrollbar-hide text-xs text-slate-600 dark:text-slate-300" disabled={!isAdmin} placeholder="Add a group description..." />
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <h3 className="text-md font-semibold mb-2">Notifications</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Choose how you get notified for messages in this group.</p>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-medium">All messages</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Get notified for every new message.</p>
                                    </div>
                                    <ToggleSwitch
                                        checked={notificationSetting === 'all'}
                                        onChange={() => setNotificationSetting('all')}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-medium">Mentions only</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Get notified only when someone @mentions you.</p>
                                    </div>
                                    <ToggleSwitch
                                        checked={notificationSetting === 'mentions'}
                                        onChange={() => setNotificationSetting('mentions')}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-medium">Off</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">You will not receive any notifications.</p>
                                    </div>
                                    <ToggleSwitch
                                        checked={notificationSetting === 'off'}
                                        onChange={() => setNotificationSetting('off')}
                                    />
                                </div>
                            </div>
                        </div>

                        {isAdmin && <div className="flex justify-end pt-4"><Button onClick={handleSaveChanges}>Save Changes</Button></div>}
                    </div>
                )}
                {activeTab === 'Members' && (
                    <div className="space-y-3">
                        {(group.members || []).map(m => {
                            const memberObj = (m as any).user || m;
                            const memberId = String(memberObj._id || memberObj.id || memberObj.uid || memberObj);
                            const fullMember = allUsers.find(u =>
                                String(u.id) === memberId ||
                                String((u as any)._id) === memberId ||
                                String((u as any).uid) === memberId
                            ) || memberObj;

                            // Comprehensive avatar check
                            const avatar = fullMember.profilePicture || fullMember.avatar || (fullMember as any).avatarUrl || (fullMember as any).profilePic ||
                                memberObj.profilePicture || memberObj.avatar || (memberObj as any).avatarUrl || (memberObj as any).profilePic;

                            const name = fullMember.name || memberObj.name || 'User';
                            const username = fullMember.username || memberObj.username || (fullMember as any).email?.split('@')[0] || memberId.slice(-4);

                            const groupAdmins = (group.members || []).filter((m: any) => m.role === 'admin').map((m: any) => m.user?.id || m.id);
                            const isAdminMember = (m as any).role === 'admin' || groupAdmins.includes(memberId) || group.admins?.includes(memberId);

                            return (
                                <div key={memberId} className="flex items-center justify-between p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/50">
                                    <div className="flex items-center space-x-3">
                                        <Avatar src={avatar} alt={name} />
                                        <div>
                                            <p className="font-semibold text-sm">{name}</p>
                                            <p className="text-xs text-slate-500">{isAdminMember ? 'Admin' : 'Member'} · @{username}</p>
                                        </div>
                                    </div>
                                    {isAdmin && memberId !== currentUser.id && (
                                        <div className="flex items-center space-x-2">
                                            {isAdminMember ? (
                                                <Button variant="secondary" onClick={() => handleMemberAction(memberId, 'demote')} className="!text-xs !py-1 !px-2" disabled={groupAdmins.length <= 1}>Demote</Button>
                                            ) : (
                                                <Button variant="secondary" onClick={() => handleMemberAction(memberId, 'promote')} className="!text-xs !py-1 !px-2">Promote</Button>
                                            )}
                                            <Button variant="ghost" onClick={() => handleMemberAction(memberId, 'remove')} className="!text-xs !py-1 !px-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40">Remove</Button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                {activeTab === 'Danger Zone' && (
                    <div className="space-y-1">
                        <button 
                            onClick={handleLeaveGroup}
                            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group"
                        >
                            <div className="text-left">
                                <p className="font-bold text-[13px] text-slate-700 dark:text-slate-200">Leave Group</p>
                                <p className="text-[10px] text-slate-400 font-medium">Exit this conversation</p>
                            </div>
                            <svg className="w-4 h-4 text-slate-300 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>

                        {isAdmin && (
                            <button 
                                onClick={handleDeleteGroup}
                                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
                            >
                                <div className="text-left">
                                    <p className="font-bold text-[13px] text-red-600">Delete Group</p>
                                    <p className="text-[10px] text-red-400 font-medium opacity-80">Erase group for everyone</p>
                                </div>
                                <svg className="w-4 h-4 text-red-300 group-hover:text-red-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}

const ChatWindow: React.FC<{
    group: Group | undefined,
    allUsers: User[],
    onUpdateGroup: (updatedGroup: Group) => void,
    onSetMessageToDelete: (details: { groupId: string; msgId: string }) => void
}> = ({ group, allUsers, onUpdateGroup, onSetMessageToDelete }) => {
    const { user } = useAuth();
    const { socket } = useSocket();
    const navigate = useNavigate();
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [group?.messages]);

    if (!user) return null;

    if (!group) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 p-12 text-center animate-in fade-in duration-500">
                <div className="mb-8 text-slate-300 dark:text-slate-600">
                    {React.cloneElement(ICONS.groups as React.ReactElement, { className: 'w-24 h-24' })}
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Select a group</h2>
                <p className="text-base max-w-[300px] mx-auto">Choose a group from the list or create a new one to start chatting with your team.</p>
            </div>
        );
    }

    const handleSendMessage = (messageText: string) => {
        if (!socket) return;
        const gId = group.id || (group as any)._id;
        socket.emit('send_group_message', {
            groupId: String(gId),
            content: messageText,
            type: 'text'
        });
    };

    const handleOpenAddMemberModal = () => {
        setIsMembersModalOpen(false);
        setIsAddMemberModalOpen(true);
    };

    const handleAddMembers = async (newMembers: User[]) => {
        const gId = group.id || (group as any)._id;
        const userIds = newMembers.map(m => (m as any)._id || m.id);
        try {
            const res = await groupsAPI.addMembers(String(gId), userIds);
            onUpdateGroup(res.data);
            setIsAddMemberModalOpen(false);
        } catch (error) {
            console.error('Failed to add members:', error);
            alert('Failed to add members. Please try again.');
        }
    };

    const groupAdmins = (group.members || []).filter((m: any) => m.role === 'admin').map((m: any) => m.user?.id || m.id);
    const isAdmin = (group.members || []).some(m => {
        const mId = String((m as any).user?._id || (m as any).user?.id || m.id || (m as any)._id);
        return mId === String(user.id) && m.role === 'admin';
    });

    const handleUpdateGroupLocal = async (updatedData: any) => {
        const gId = group.id || (group as any)._id;
        try {
            const res = await groupsAPI.updateGroup(String(gId), updatedData);
            onUpdateGroup(res.data);
        } catch (error) {
            console.error('Failed to update group:', error);
        }
    };

    return (
        <>
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-800">
                <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
                    <button
                        onClick={() => navigate('/groups')}
                        className="md:hidden p-2 -ml-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <Avatar src={group.avatar} alt={group.name} />
                    <div className="flex-1 min-w-0">
                        <h2 className="text-[17px] font-semibold text-slate-900 dark:text-white truncate">{group.name}</h2>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            <span className="cursor-pointer hover:underline" onClick={() => setIsMembersModalOpen(true)}>
                                {(group.members || []).length} members
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button onClick={() => setIsMembersModalOpen(true)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400" title="View Members">{ICONS.users}</button>
                        <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400" title="Group Settings">{ICONS.settings}</button>
                    </div>
                </header>
                <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto bg-white dark:bg-slate-900 scrollbar-hide">
                    {(group.messages || []).map((msg, index) => {
                        const senderId = String(msg.sender?.id || (msg.sender as any)?._id || '');
                        const isOwnMessage = senderId === String(user.id);
                        const messageText = msg.text || (msg as any).content || '';
                        const messageTime = msg.timestamp || (msg as any).createdAt;
                        const senderAvatar = msg.sender?.avatar || (msg.sender as any)?.profilePicture || (msg.sender as any)?.avatar || '';

                        return (
                            <div key={msg.id || index} className={`flex items-end gap-2 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                                {!isOwnMessage && (
                                    <Avatar src={senderAvatar} alt={msg.sender?.name || 'User'} size="sm" className="mb-5" />
                                )}
                                <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[75%] sm:max-w-[70%]`}>
                                    <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm ${
                                        isOwnMessage 
                                            ? 'bg-blue-600 text-white rounded-br-none' 
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none'
                                    }`}>
                                        {!isOwnMessage && (
                                            <p className="font-bold text-[10px] uppercase tracking-wider mb-1 text-blue-500 dark:text-blue-400">
                                                {msg.sender?.name || 'Someone'}
                                            </p>
                                        )}
                                        <p className="leading-relaxed break-words">{messageText}</p>
                                    </div>
                                    <span className="text-[10px] mt-1 font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
                                        {messageTime ? new Date(messageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
                <ChatInput onSendMessage={handleSendMessage} />
            </div>
            <GroupMembersModal
                isOpen={isMembersModalOpen}
                onClose={() => setIsMembersModalOpen(false)}
                members={group.members}
                allUsers={allUsers}
                currentUser={user}
                isAdmin={isAdmin}
                onAddMemberClick={handleOpenAddMemberModal}
            />
            <GroupSettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                group={group}
                allUsers={allUsers}
                currentUser={user}
                onUpdateGroup={handleUpdateGroupLocal}
            />
            <AddGroupMembersModal
                isOpen={isAddMemberModalOpen}
                onClose={() => setIsAddMemberModalOpen(false)}
                group={group}
                allUsers={allUsers}
                onAddMembers={handleAddMembers}
            />
        </>
    );
}

const CreateGroupModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onCreate: (groupName: string, members: User[]) => void;
    currentUser: User;
}> = ({ isOpen, onClose, onCreate, currentUser }) => {
    const [groupName, setGroupName] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<User[]>([currentUser]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showError, setShowError] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            usersAPI.getUsers().then(res => {
                setAllUsers(res.data);
                setIsLoading(false);
            }).catch(err => {
                console.error('Failed to fetch users:', err);
                setIsLoading(false);
            });
        }
    }, [isOpen]);

    const handleToggleUser = (user: User) => {
        const userId = (user as any)._id || user.id || (user as any).uid;
        if (!userId) return;

        setSelectedUsers(prev => {
            const isSelected = prev.some(u => ((u as any)._id || u.id || (u as any).uid) === userId);
            if (isSelected) {
                return prev.filter(u => ((u as any)._id || u.id || (u as any).uid) !== userId);
            } else {
                return [...prev, user];
            }
        });
    };

    const filteredUsers = allUsers.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        ((u as any).email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSubmit = () => {
        if (!groupName.trim()) {
            setShowError(true);
            nameInputRef.current?.focus();
            return;
        }

        if (selectedUsers.length >= 1) {
            onCreate(groupName, selectedUsers);
            onClose();
            setGroupName('');
            setSelectedUsers([currentUser]);
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New Group" size="sm">
            <div className="flex flex-col space-y-3 bg-white dark:bg-slate-900 -m-1">
                <div className="px-4 pt-2">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">
                        Group Name <span className="text-red-500 text-[12px]">*</span>
                    </label>
                    <Input
                        ref={nameInputRef}
                        placeholder="Name your group..."
                        value={groupName}
                        onChange={(e) => {
                            setGroupName(e.target.value);
                            if (showError) setShowError(false);
                        }}
                        className={`h-8 text-[13px] bg-slate-50/50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800 transition-all ${showError ? 'animate-shake-red ring-1 ring-red-500 border-red-500' : ''
                            }`}
                        onAnimationEnd={() => setShowError(false)}
                    />
                </div>

                <div className="px-4 pt-1 flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Suggested</label>
                    <div className="flex items-center space-x-1.5 max-w-[110px] border-b border-slate-200 dark:border-slate-700 pb-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-transparent border-none outline-none text-[11px] text-slate-900 dark:text-white placeholder-slate-400"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="max-h-[260px] overflow-y-auto px-1 py-1 scrollbar-hide">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-[12px] text-slate-500 italic">No users found</p>
                            </div>
                        ) : filteredUsers.map(user => {
                            const userId = (user as any)._id || user.id || (user as any).uid;
                            const isSelected = selectedUsers.some(su => ((su as any)._id || su.id || (su as any).uid) === userId);

                            return (
                                <div
                                    key={userId}
                                    onClick={() => handleToggleUser(user)}
                                    className="flex items-center space-x-3 px-3 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                >
                                    <Avatar src={(user as any).profilePicture || (user as any).avatar} alt={user.name} size="sm" className="w-8 h-8 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-[12.5px] text-slate-900 dark:text-white truncate leading-none mb-0.5">{user.name}</p>
                                        <p className="text-[11px] text-slate-500 truncate leading-none">{(user as any).username || (user as any).email.split('@')[0]}</p>
                                    </div>
                                    <div className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-red-500 border-red-500' : 'border-slate-300 dark:border-slate-700'
                                        }`}>
                                        {isSelected && (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-4 pt-2 border-t border-slate-50 dark:border-slate-800">
                    <Button
                        onClick={handleSubmit}
                        disabled={selectedUsers.length < 1}
                        className="w-full h-9 text-[13px] font-bold rounded-lg shadow-sm"
                    >
                        Create Group
                    </Button>
                </div>
            </div>
        </Modal>
    )
}

export const GroupsPage: React.FC = () => {
    const { user } = useAuth();
    const [groups, setGroups] = useState<Group[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [messageToDelete, setMessageToDelete] = useState<{ groupId: string; msgId: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const navigate = useNavigate();
    const { socket } = useSocket();

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [groupsRes, usersRes] = await Promise.all([
                groupsAPI.getGroups(),
                usersAPI.getUsers()
            ]);
            setGroups(groupsRes.data);
            // Handle both array and object response from getUsers
            const userData = usersRes.data.users || usersRes.data.data || (Array.isArray(usersRes.data) ? usersRes.data : []);
            setAllUsers(userData);
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const { refreshGroupCounts } = useMessages();

    // Mark invitations as read globally when visiting groups page
    useEffect(() => {
        const clearInvitations = async () => {
            try {
                await import('../src/api/notifications').then(m => m.notificationsAPI.markAllTypeAsRead('GROUP_ADDED'));
                refreshGroupCounts();
            } catch (err) {
                console.error('Error clearing group invitations:', err);
            }
        };
        clearInvitations();
    }, [refreshGroupCounts]);

    // Mark as read when group is selected
    useEffect(() => {

        if (selectedGroupId && groups.length > 0) {
            const group = groups.find(g => String((g as any)._id || g.id) === String(selectedGroupId));
            if (group) {
                // Optimistically clear local count if it's > 0
                if ((group as any).unreadCount > 0) {
                    setGroups(prev => prev.map(g => {
                        if (String(g.id || (g as any)._id) === String(selectedGroupId)) {
                            return { ...g, unreadCount: 0 };
                        }
                        return g;
                    }));
                }

                // Call API and refresh global counts
                groupsAPI.markAsRead(String(selectedGroupId)).then(() => {
                    refreshGroupCounts();
                }).catch(err => {
                    console.error('Failed to mark group as read:', err);
                });
            }
        }
    }, [selectedGroupId, groups.length, refreshGroupCounts]);


    if (!user) return null;

    const handleBack = () => {
        navigate(-1);
    };

    const userGroups = Array.isArray(groups) ? groups : [];
    const activeGroup = userGroups.find(g => String((g as any)._id) === String(selectedGroupId) || String(g.id) === String(selectedGroupId));

    const openGroup = (group: Group) => {
        const id = String((group as any)._id || group.id);
        setSelectedGroupId(id);
        navigate(`/groups/${id}`);
    };

    const handleCreateGroup = async (groupName: string, members: User[]) => {
        try {
            const res = await groupsAPI.createGroup({
                name: groupName,
                members: members.map(m => (m as any)._id || m.id)
            });
            setGroups([res.data, ...groups]);
            navigate('/groups');
        } catch (err) {
            console.error('Failed to create group:', err);
            alert('Failed to create group. Please try again.');
        }
    };

    const handleUpdateGroup = async (updatedGroup: Group) => {
        const groupId = updatedGroup.id || (updatedGroup as any)._id;
        try {
            const response = await groupsAPI.updateGroup(String(groupId), updatedGroup);
            const savedGroup = response.data || updatedGroup;
            setGroups(prevGroups => prevGroups.map(g => {
                const gId = g.id || (g as any)._id;
                return String(gId) === String(groupId) ? savedGroup : g;
            }));
        } catch (error) {
            console.error('Failed to update group:', error);
        }
    };

    useEffect(() => {
        if (!socket) return;

        const onNewMessage = (msg: any) => {
            setGroups(prevGroups => prevGroups.map(g => {
                const gId = g.id || (g as any)._id;
                if (String(gId) !== String(msg.groupId)) return g;

                const isCurrentlyActive = String(selectedGroupId) === String(msg.groupId);
                let newUnreadCount = (g as any).unreadCount || 0;

                if (!isCurrentlyActive) {
                    const setting = (g as any).notificationSetting || 'all';
                    const mentionName = user.name.split(' ')[0];
                    const content = msg.content || msg.text || '';
                    const isMentioned = content.includes(`@${user.name}`) ||
                        content.includes(`@${user.username}`) ||
                        content.toLowerCase().includes(`@${mentionName.toLowerCase()}`);

                    if (setting === 'all' || (setting === 'mentions' && isMentioned)) {
                        newUnreadCount++;
                    }
                } else {
                    groupsAPI.markAsRead(String(gId)).then(() => {
                        refreshGroupCounts();
                    }).catch(err => {
                        console.error('Failed to mark active group as read:', err);
                    });
                    newUnreadCount = 0;
                }

                const messageExists = (g.messages || []).some((m: any) => String(m.id) === String(msg.id));
                const formattedMessage = {
                    id: msg.id,
                    type: msg.type || 'text',
                    sender: msg.sender || { id: msg.senderId, name: msg.senderName, avatar: msg.senderAvatar },
                    content: msg.content || msg.text || '',
                    text: msg.text || msg.content || '',
                    createdAt: msg.createdAt || msg.timestamp || new Date().toISOString(),
                    timestamp: msg.timestamp || msg.createdAt,
                };

                return {
                    ...g,
                    messages: messageExists ? (g.messages || []) : [...(g.messages || []), formattedMessage],
                    unreadCount: newUnreadCount
                };
            }));
        };

        const onGroupUpdated = (updatedGroup: Group) => {
            setGroups(prevGroups => prevGroups.map(g => {
                const gId = g.id || (g as any)._id;
                const updatedId = updatedGroup.id || (updatedGroup as any)._id;
                if (String(gId) === String(updatedId)) {
                    return { ...g, ...updatedGroup, messages: g.messages };
                }
                return g;
            }));
        };

        const onGroupAddedTo = (newGroup: Group) => {
            setGroups(prevGroups => {
                const exists = prevGroups.some(g => String(g.id || (g as any)._id) === String(newGroup.id || (newGroup as any)._id));
                if (exists) {
                    return prevGroups.map(g => String(g.id || (g as any)._id) === String(newGroup.id || (newGroup as any)._id) ? newGroup : g);
                }
                return [newGroup, ...prevGroups];
            });
        };

        const onGroupRemovedFrom = (data: { groupId: string }) => {
            setGroups(prevGroups => prevGroups.filter(g => String(g.id || (g as any)._id) !== String(data.groupId)));
            if (String(selectedGroupId) === String(data.groupId)) {
                setSelectedGroupId(null);
                navigate('/groups');
            }
        };

        socket.on('new_group_message', onNewMessage);
        socket.on('group_updated', onGroupUpdated);
        socket.on('group_added_to', onGroupAddedTo);
        socket.on('group_removed_from', onGroupRemovedFrom);

        return () => { 
            socket.off('new_group_message', onNewMessage);
            socket.off('group_updated', onGroupUpdated);
            socket.off('group_added_to', onGroupAddedTo);
            socket.off('group_removed_from', onGroupRemovedFrom);
        };
    }, [socket, selectedGroupId, user, navigate]);

    // Global listener for leave events
    useEffect(() => {
        (window as any).handleGroupLeave = (leftGroupId: string) => {
            setGroups(prevGroups => prevGroups.filter(g => (g.id || (g as any)._id) !== leftGroupId));
            if (String(selectedGroupId) === String(leftGroupId)) {
                setSelectedGroupId(null);
                navigate('/groups');
            }
        };
        return () => { delete (window as any).handleGroupLeave; };
    }, [selectedGroupId, navigate]);

    const handleConfirmDelete = () => {
        if (!messageToDelete) return;

        const { groupId, msgId } = messageToDelete;
        const groupToUpdate = groups.find(g => g.id === groupId);

        if (groupToUpdate) {
            const updatedGroup = {
                ...groupToUpdate,
                messages: groupToUpdate.messages.filter(msg => msg.id !== msgId),
            };
            handleUpdateGroup(updatedGroup);
        }

        setMessageToDelete(null);
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900 h-full">
                <div className="h-8 w-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <>
            <div className="h-full flex text-sm">
                <aside className={`w-full md:w-[320px] lg:w-[360px] flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${selectedGroupId ? 'hidden md:flex' : 'flex'}`}>
                    <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
                        <div className="flex items-center gap-4 min-w-0">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2 -ml-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">Groups</h1>
                        </div>

                        <Button variant="ghost" className="!p-2" onClick={() => { setSelectedGroupId(null); setIsCreateModalOpen(true); }} title="Create new group">
                            {ICONS.plus}
                        </Button>
                    </header>
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <Input placeholder="Search groups..." />
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {userGroups.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 min-h-[400px]">
                                <div className="mb-6 text-slate-300 dark:text-slate-600">
                                    {React.cloneElement(ICONS.groups as React.ReactElement, { className: "w-20 h-20 md:w-14 md:h-14 mx-auto" })}
                                </div>
                                <h3 className="text-xl md:text-lg font-bold text-slate-900 dark:text-white mb-2">No groups yet</h3>
                                <p className="text-sm md:text-xs text-slate-500 dark:text-slate-400 max-w-[240px] md:max-w-[180px] mx-auto leading-relaxed">
                                    Create a group to start collaborating with others!
                                </p>
                                <Button
                                    variant="secondary"
                                    className="mt-8 px-8 md:mt-6 md:px-4 md:py-1.5 md:text-sm"
                                    onClick={() => setIsCreateModalOpen(true)}
                                >
                                    Create New Group
                                </Button>
                            </div>
                        ) : (
                            <ul>
                                {userGroups.map(group => {
                                    const messages = group.messages || [];
                                    const lastMessage = messages[messages.length - 1];
                                    const groupIdValue = String(group.id || (group as any)._id);
                                    const isSelected = String(selectedGroupId) === groupIdValue;
                                    return (
                                        <li key={group.id || (group as any)._id}>
                                            <button
                                                type="button"
                                                onClick={() => openGroup(group)}
                                                className={`w-full text-left flex items-center p-4 space-x-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-l-4 ${isSelected ? 'border-red-500 bg-slate-50 dark:bg-slate-900/50' : 'border-transparent'}`}
                                            >
                                                <Avatar src={group.avatar} alt={group.name} />
                                                <div className="flex-1 overflow-hidden">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center">
                                                            <p className="font-semibold truncate">{group.name}</p>
                                                            {(group as any).unreadCount > 0 && (
                                                                <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full ml-2 shadow-sm animate-pulse-subtle">
                                                                    {(group as any).unreadCount}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {lastMessage && (lastMessage.timestamp || (lastMessage as any).createdAt) && (
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                {new Date(lastMessage.timestamp || (lastMessage as any).createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex justify-between items-center mt-0.5">
                                                        {lastMessage ?
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                                {lastMessage.sender?.name || 'Someone'}: {lastMessage.text || (lastMessage as any).content}
                                                            </p>
                                                            : <p className="text-xs text-slate-500 dark:text-slate-400 italic">No messages yet.</p>
                                                        }
                                                    </div>
                                                </div>
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </div>
                </aside>
                <div className={`${selectedGroupId ? 'flex' : 'hidden'} md:flex flex-1`}>
                    <ChatWindow
                        group={activeGroup}
                        allUsers={allUsers}
                        onUpdateGroup={handleUpdateGroup}
                        onSetMessageToDelete={setMessageToDelete}
                    />
                </div>
            </div>
            <CreateGroupModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCreate={handleCreateGroup}
                currentUser={user}
            />
            <Modal
                isOpen={!!messageToDelete}
                onClose={() => setMessageToDelete(null)}
                title="Delete Message"
            >
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Are you sure you want to permanently delete this message? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="secondary" onClick={() => setMessageToDelete(null)}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-500">
                        Delete
                    </Button>
                </div>
            </Modal>
        </>
    );
};