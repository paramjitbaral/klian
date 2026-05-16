import React, { useState, useRef, useEffect } from 'react';
import { useParams, NavLink, useNavigate } from 'react-router-dom';
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

const AddGroupMembersModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAddMembers: (newMembers: User[]) => void;
    group: Group;
}> = ({ isOpen, onClose, onAddMembers, group }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!isOpen) {
            setSearchTerm('');
            setSelectedUsers(new Set());
        }
    }, [isOpen]);

    const existingMemberIds = new Set(group.members.map(m => m.id));
    const allUsers = Object.values(USERS);

    const usersAvailableToAdd = allUsers.filter(user => 
        !existingMemberIds.has(user.id) &&
        (user.name.toLowerCase().includes(searchTerm.toLowerCase()) || user.username.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleToggleUser = (userId: string) => {
        setSelectedUsers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return newSet;
        });
    };

    const handleAdd = () => {
        const newMembers = allUsers.filter(u => selectedUsers.has(u.id));
        onAddMembers(newMembers);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Add Members to ${group.name}`}>
            <div className="space-y-4">
                <Input 
                    placeholder="Search for users..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    icon={React.cloneElement(ICONS.search, { className: 'h-5 w-5' })}
                />
                <div className="max-h-60 overflow-y-auto space-y-2 p-2 bg-slate-100 dark:bg-slate-700 rounded-md">
                    {usersAvailableToAdd.length > 0 ? usersAvailableToAdd.map(user => (
                        <label key={user.id} className="flex items-center space-x-3 p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedUsers.has(user.id)}
                                onChange={() => handleToggleUser(user.id)}
                                className="h-4 w-4 rounded text-red-600 focus:ring-red-500"
                            />
                            <Avatar src={user.avatar} alt={user.name} size="sm" />
                            <div>
                                <p className="font-semibold text-sm">{user.name}</p>
                                <p className="text-xs text-slate-500">@{user.username}</p>
                            </div>
                        </label>
                    )) : (
                        <p className="text-center text-sm text-slate-500 py-4">No users found.</p>
                    )}
                </div>
                <div className="flex justify-end pt-2">
                    <Button onClick={handleAdd} disabled={selectedUsers.size === 0}>
                        Add {selectedUsers.size > 0 ? `(${selectedUsers.size})` : 'Member(s)'}
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
    currentUser: User;
    isAdmin: boolean;
    onAddMemberClick: () => void;
}> = ({ isOpen, onClose, members, currentUser, isAdmin, onAddMemberClick }) => {
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
            <div className="space-y-4 max-h-96 overflow-y-auto">
                {members.map(member => {
                    const isFollowing = followedUsers.has(member.id);
                    return (
                        <div key={member.id} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <Avatar src={member.avatar} alt={member.name} />
                                <div className="flex-1">
                                    <p className="font-semibold">{member.name} {member.id === currentUser.id && <span className="text-xs text-slate-500">(You)</span>}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        @{member.username} · <span className={member.lastSeen === 'Online' ? 'text-green-500' : ''}>{member.lastSeen}</span>
                                    </p>
                                </div>
                            </div>
                            {member.id !== currentUser.id && (
                                <Button
                                    variant={isFollowing ? 'ghost' : 'secondary'}
                                    className="!px-3 !py-1 !text-sm"
                                    onClick={() => handleFollowToggle(member.id)}
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
    currentUser: User;
    onUpdateGroup: (updatedGroup: Group) => void;
}> = ({ isOpen, onClose, group, currentUser, onUpdateGroup }) => {
    const [activeTab, setActiveTab] = useState<GroupSettingsTab>('General');
    const [groupName, setGroupName] = useState(group.name);
    const [groupDescription, setGroupDescription] = useState(group.description || '');
    const [notificationSetting, setNotificationSetting] = useState<NotificationSetting>('all');
    const isAdmin = group.admins.includes(currentUser.id);
    
    const handleSaveChanges = () => {
        // In a real app, you'd also save the notificationSetting for the current user.
        onUpdateGroup({ ...group, name: groupName, description: groupDescription });
        onClose();
    };

    const handleMemberAction = (memberId: string, action: 'remove' | 'promote' | 'demote') => {
        let updatedGroup = { ...group };
        if (action === 'remove') {
            if (window.confirm('Are you sure you want to remove this member?')) {
                updatedGroup.members = group.members.filter(m => m.id !== memberId);
                updatedGroup.admins = group.admins.filter(adminId => adminId !== memberId);
            }
        } else if (action === 'promote') {
            updatedGroup.admins = [...group.admins, memberId];
        } else if (action === 'demote') {
            updatedGroup.admins = group.admins.filter(adminId => adminId !== memberId);
        }
        onUpdateGroup(updatedGroup);
    };

    const handleLeaveGroup = () => {
        if (window.confirm('Are you sure you want to leave this group?')) {
            const updatedGroup = { ...group };
            updatedGroup.members = group.members.filter(m => m.id !== currentUser.id);
            if (isAdmin) {
                updatedGroup.admins = group.admins.filter(adminId => adminId !== currentUser.id);
                // If last admin leaves, promote the longest-standing member
                if (updatedGroup.admins.length === 0 && updatedGroup.members.length > 0) {
                    updatedGroup.admins.push(updatedGroup.members[0].id);
                }
            }
            onUpdateGroup(updatedGroup);
            onClose();
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
        `px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        activeTab === tab 
            ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
            : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300'
    }`;
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Group Settings">
            <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4">
                <button onClick={() => setActiveTab('General')} className={tabButtonClasses('General')}>General</button>
                <button onClick={() => setActiveTab('Members')} className={tabButtonClasses('Members')}>Members</button>
                <button onClick={() => setActiveTab('Danger Zone')} className={tabButtonClasses('Danger Zone')}>Danger Zone</button>
            </div>

            <div className="max-h-96 overflow-y-auto pr-2">
                {activeTab === 'General' && (
                    <div className="space-y-4">
                        <Input label="Group Name" value={groupName} onChange={e => setGroupName(e.target.value)} disabled={!isAdmin} />
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                            <textarea value={groupDescription} onChange={e => setGroupDescription(e.target.value)} rows={3} className="w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none disabled:opacity-70" disabled={!isAdmin} />
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
                        {group.members.map(member => (
                            <div key={member.id} className="flex items-center justify-between p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/50">
                                <div className="flex items-center space-x-3">
                                    <Avatar src={member.avatar} alt={member.name} />
                                    <div>
                                        <p className="font-semibold">{member.name}</p>
                                        <p className="text-xs text-slate-500">{group.admins.includes(member.id) ? 'Admin' : 'Member'}</p>
                                    </div>
                                </div>
                                {isAdmin && member.id !== currentUser.id && (
                                    <div className="flex items-center space-x-2">
                                        {group.admins.includes(member.id) ? (
                                            <Button variant="secondary" onClick={() => handleMemberAction(member.id, 'demote')} className="!text-xs !py-1 !px-2" disabled={group.admins.length <= 1}>Demote</Button>
                                        ) : (
                                            <Button variant="secondary" onClick={() => handleMemberAction(member.id, 'promote')} className="!text-xs !py-1 !px-2">Promote</Button>
                                        )}
                                        <Button variant="ghost" onClick={() => handleMemberAction(member.id, 'remove')} className="!text-xs !py-1 !px-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40">Remove</Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                {activeTab === 'Danger Zone' && (
                     <div className="space-y-4">
                        <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                            <div>
                                <h3 className="font-medium text-red-800 dark:text-red-300">Leave Group</h3>
                                <p className="text-sm text-red-600 dark:text-red-400">You will be removed from the group and will no longer receive messages.</p>
                            </div>
                            <Button onClick={handleLeaveGroup} className="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white">Leave</Button>
                        </div>
                        {isAdmin && (
                             <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                                <div>
                                    <h3 className="font-medium text-red-800 dark:text-red-300">Delete Group</h3>
                                    <p className="text-sm text-red-600 dark:text-red-400">This will permanently delete the group for everyone. This cannot be undone.</p>
                                </div>
                                <Button onClick={handleDeleteGroup} className="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white">Delete</Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}

const parseMarkdownToHTML = (text: string): string => {
  let escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  escapedText = escapedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  escapedText = escapedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
  escapedText = escapedText.replace(/__(.*?)__/g, '<u>$1</u>');

  return escapedText;
};

const ChatWindow: React.FC<{ 
    group: Group | undefined, 
    onUpdateGroup: (updatedGroup: Group) => void,
    onSetMessageToDelete: (details: { groupId: string; msgId: string }) => void 
}> = ({ group, onUpdateGroup, onSetMessageToDelete }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    useEffect(() => {
        scrollToBottom()
    }, [group?.messages]);
    
    if (!user) return null;

    if (!group) {
        return (
            <div className="flex-1 flex-col items-center justify-center text-slate-500 dark:text-slate-400 hidden md:flex">
                <div className="text-center">
                    {ICONS.groups}
                    <h2 className="text-xl font-semibold mt-4">Select a group</h2>
                    <p>Start chatting in your groups.</p>
                </div>
            </div>
        );
    }
    
    const handleSendMessage = (messageText: string) => {
        if (!user || !group) return;

        const newMessage: GroupMessage = {
            id: `gmsg-${Date.now()}`,
            sender: user,
            text: messageText,
            timestamp: new Date().toISOString(),
        };

        const updatedGroup = {
            ...group,
            messages: [...group.messages, newMessage],
        };
        onUpdateGroup(updatedGroup);
    };

    const handleOpenAddMemberModal = () => {
        setIsMembersModalOpen(false);
        setIsAddMemberModalOpen(true);
    };

    const handleAddMembers = (newMembers: User[]) => {
        if (!group) return;
        const updatedGroup = {
            ...group,
            members: [...group.members, ...newMembers],
        };
        onUpdateGroup(updatedGroup);
        setIsAddMemberModalOpen(false);
    };

    const isAdmin = group.admins.includes(user.id);

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
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">{group.name}</h2>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        <span className="cursor-pointer hover:underline" onClick={() => setIsMembersModalOpen(true)}>
                            {group.members.length} members
                        </span>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <button onClick={() => setIsMembersModalOpen(true)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400" title="View Members">{ICONS.users}</button>
                    <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400" title="Group Settings">{ICONS.settings}</button>
                </div>
            </header>
            <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto bg-slate-100 dark:bg-slate-900">
                {group.messages.map((msg, index) => {
                    const prevMessage = group.messages[index - 1];
                    const isFirstInSequence = !prevMessage || prevMessage.sender.id !== msg.sender.id;
                    const isOwnMessage = msg.sender.id === user.id;

                    if (isOwnMessage) {
                        return <MessageBubble 
                            key={msg.id} 
                            message={msg} 
                            isOwnMessage={true} 
                            onDelete={() => onSetMessageToDelete({ groupId: group.id, msgId: msg.id })}
                        />;
                    }
                    
                    return (
                        <div key={msg.id}>
                            {isFirstInSequence && (
                                <div className="flex items-center space-x-2 mb-1">
                                  <Avatar src={msg.sender.avatar} alt={msg.sender.name} size="sm" />
                                  <p className="font-semibold text-sm text-red-500 dark:text-red-400">{msg.sender.name}</p>
                                </div>
                            )}
                            <div className={`flex`}>
                                {/* Indent subsequent messages to align with avatar */}
                                <div className="w-10 flex-shrink-0"/>
                                <div className="max-w-xs md:max-w-md p-3 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-none">
                                    <p className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: parseMarkdownToHTML(msg.text) }}/>
                                    <p className="text-xs mt-1 opacity-70 text-left">
                                       {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )
                })}
                 <div ref={messagesEndRef} />
            </div>
            <ChatInput onSendMessage={handleSendMessage} />
        </div>
        <GroupMembersModal 
            isOpen={isMembersModalOpen}
            onClose={() => setIsMembersModalOpen(false)}
            members={group.members}
            currentUser={user}
            isAdmin={isAdmin}
            onAddMemberClick={handleOpenAddMemberModal}
        />
        <GroupSettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            group={group}
            currentUser={user}
            onUpdateGroup={onUpdateGroup}
        />
        <AddGroupMembersModal 
            isOpen={isAddMemberModalOpen}
            onClose={() => setIsAddMemberModalOpen(false)}
            group={group}
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
    const allUsers = Object.values(USERS);

    const handleToggleUser = (user: User) => {
        setSelectedUsers(prev => 
            prev.some(u => u.id === user.id) 
                ? prev.filter(u => u.id !== user.id)
                : [...prev, user]
        );
    };

    const handleSubmit = () => {
        if(groupName.trim() && selectedUsers.length > 1) {
            onCreate(groupName, selectedUsers);
            onClose();
            setGroupName('');
            setSelectedUsers([currentUser]);
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create New Group">
            <div className="space-y-4">
                <Input label="Group Name" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g., Project Team" />
                <div>
                    <h3 className="text-sm font-medium mb-2">Select Members</h3>
                    <div className="max-h-60 overflow-y-auto space-y-2 p-2 bg-slate-100 dark:bg-slate-700 rounded-md">
                        {allUsers.map(user => (
                            <div key={user.id} className="flex items-center space-x-3 p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-600">
                                <input
                                    type="checkbox"
                                    checked={selectedUsers.some(su => su.id === user.id)}
                                    onChange={() => handleToggleUser(user)}
                                    disabled={user.id === currentUser.id}
                                    className="h-4 w-4 rounded text-red-600 focus:ring-red-500"
                                />
                                <Avatar src={user.avatar} alt={user.name} size="sm" />
                                <div>
                                    <p className="font-semibold text-sm">{user.name}</p>
                                    <p className="text-xs text-slate-500">@{user.username}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                 <div className="flex justify-end pt-2">
                    <Button onClick={handleSubmit}>Create Group</Button>
                </div>
            </div>
        </Modal>
    )
}

export const GroupsPage: React.FC = () => {
    const { groupId } = useParams();
    const { user } = useAuth();
    const [groups, setGroups] = useState(MOCK_GROUPS);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [messageToDelete, setMessageToDelete] = useState<{ groupId: string; msgId: string } | null>(null);
    const navigate = useNavigate();
    
    if (!user) return null;

    const handleBack = () => {
        if (window.history.length > 2 && window.history.state?.idx > 0) {
            navigate(-1);
        } else {
            navigate('/home', { replace: true });
        }
    };

    const userGroups = groups.filter(g => g.members.some(m => m.id === user.id));
    const activeGroup = userGroups.find(g => g.id === groupId);

    const handleCreateGroup = (groupName: string, members: User[]) => {
        const newGroup: Group = {
            id: `group-${Date.now()}`,
            name: groupName,
            avatar: `https://picsum.photos/seed/${groupName}/200`,
            members,
            admins: [user.id],
            messages: []
        };
        setGroups([newGroup, ...groups]);
    }

    const handleUpdateGroup = (updatedGroup: Group) => {
        setGroups(prevGroups => prevGroups.map(g => g.id === updatedGroup.id ? updatedGroup : g));
    };

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

    return (
        <>
            <div className="h-full flex text-sm">
                <aside className={`w-full md:w-[320px] lg:w-[360px] flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${groupId ? 'hidden md:flex' : 'flex'}`}>
                <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
                    <div className="flex items-center gap-4 min-w-0">
                        <button 
                            onClick={() => navigate('/home')} 
                            className="p-2 -ml-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate md:hidden">Groups</h1>
                    </div>

                    <Button variant="ghost" className="!p-2" onClick={() => setIsCreateModalOpen(true)} title="Create new group">
                        {ICONS.plus}
                    </Button>
                </header>
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <Input placeholder="Search groups..." />
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <ul>
                            {userGroups.map(group => {
                                 const lastMessage = group.messages[group.messages.length - 1];
                                 return (
                                    <li key={group.id}>
                                        <NavLink to={`/groups/${group.id}`} className={({ isActive }) => `flex items-center p-4 space-x-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-l-4 ${isActive ? 'border-red-500 bg-slate-50 dark:bg-slate-900/50' : 'border-transparent'}`}>
                                            <Avatar src={group.avatar} alt={group.name} />
                                            <div className="flex-1 overflow-hidden">
                                                <div className="flex justify-between items-center">
                                                    <p className="font-semibold truncate">{group.name}</p>
                                                    {lastMessage && <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                                                </div>
                                                <div className="flex justify-between items-center mt-0.5">
                                                    {lastMessage ? 
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{lastMessage.sender.name}: {lastMessage.text}</p>
                                                        : <p className="text-xs text-slate-500 dark:text-slate-400 italic">No messages yet.</p>
                                                    }
                                                </div>
                                            </div>
                                        </NavLink>
                                    </li>
                                 )
                            })}
                        </ul>
                    </div>
                </aside>
                <div className={`${groupId ? 'flex' : 'hidden'} md:flex flex-1`}>
                    <ChatWindow 
                        group={activeGroup} 
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