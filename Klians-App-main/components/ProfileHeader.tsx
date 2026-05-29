import React from 'react';
import { User } from '../types';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { ICONS } from '../constants';

interface ProfileHeaderProps {
    user: User;
    postCount: number;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ user, postCount }) => {
    return (
        <header className="flex flex-col md:flex-row items-center gap-y-4 md:gap-x-10 lg:gap-x-20 px-4">
            <div className="flex-shrink-0">
                <Avatar src={user.avatar} alt={user.name} size="xxl" className="border-4 border-white dark:border-slate-800 shadow-lg"/>
            </div>
            <div className="space-y-4 flex-grow w-full md:w-auto text-center md:text-left">
                <div className="flex flex-col md:flex-row items-center md:items-end gap-x-4 gap-y-2">
                    <h1 className="text-2xl font-light text-slate-800 dark:text-slate-100">{user.username}</h1>
                    <div className="flex items-center gap-x-2">
                        <Button variant="secondary" className="!py-1 !px-4 !text-sm font-semibold">Edit Profile</Button>
                        <Button variant="ghost" className="!p-2">
                            {ICONS.settings}
                        </Button>
                    </div>
                </div>
                <div className="flex items-center justify-center md:justify-start gap-x-8 text-md">
                    <p><span className="font-semibold">{postCount}</span> posts</p>
                    <p><span className="font-semibold">{user.followers?.toLocaleString() || 0}</span> followers</p>
                    <p><span className="font-semibold">{user.following?.toLocaleString() || 0}</span> following</p>
                </div>
                <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{user.name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{user.bio}</p>
                </div>
            </div>
        </header>
    );
};
