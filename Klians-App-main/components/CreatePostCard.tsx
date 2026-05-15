import React from 'react';
import { User, Role } from '../types';
import { Avatar } from './ui/Avatar';
import { ICONS } from '../constants';

interface CreatePostCardProps {
    user: User;
    onComposeClick: () => void;
    onComposeWithFile?: (file: File, type: 'image' | 'video' | 'document') => void;
}

export const CreatePostCard: React.FC<CreatePostCardProps> = ({ user, onComposeClick, onComposeWithFile }) => {
    const imageInputRef = React.useRef<HTMLInputElement>(null);
    const videoInputRef = React.useRef<HTMLInputElement>(null);
    const docInputRef = React.useRef<HTMLInputElement>(null);

    const canPost = user.role === Role.TEACHER || user.role === Role.DEAN || user.role === Role.ADMIN || user.role?.toLowerCase() === 'dean';
    if (!canPost) {
        return null;
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'document') => {
        const file = e.target.files?.[0];
        if (file && onComposeWithFile) {
            onComposeWithFile(file, type);
        }
        // Reset input so the same file can be selected again if needed
        e.target.value = '';
    };
    
    return (
        <div 
            className="mb-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 p-2 pl-3 flex items-center gap-4 transition-all hover:border-slate-200 dark:hover:border-slate-600 cursor-pointer group"
            onClick={onComposeClick}
            role="button"
            aria-label="Create a new post"
        >
            <Avatar src={user.avatar} alt={user.name} size="sm" />
            
            <div className="flex-grow text-slate-400 dark:text-slate-500 text-sm font-medium">
                What's on your mind?
            </div>

            <div className="flex items-center gap-1 pr-1">
                <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'image')} />
                <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={(e) => handleFileChange(e, 'video')} />
                <input type="file" ref={docInputRef} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(e) => handleFileChange(e, 'document')} />

                <div 
                    className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-red-500 transition-all duration-200" 
                    title="Add Photo"
                    onClick={(e) => { e.stopPropagation(); imageInputRef.current?.click(); }}
                >
                    {React.cloneElement(ICONS.media, { className: "h-5 w-5" })}
                </div>
                <div 
                    className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-500 transition-all duration-200" 
                    title="Add Video"
                    onClick={(e) => { e.stopPropagation(); videoInputRef.current?.click(); }}
                >
                    {React.cloneElement(ICONS.video, { className: "h-5 w-5" })}
                </div>
                <div 
                    className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-emerald-500 transition-all duration-200" 
                    title="Add Document"
                    onClick={(e) => { e.stopPropagation(); docInputRef.current?.click(); }}
                >
                    {React.cloneElement(ICONS.document, { className: "h-5 w-5" })}
                </div>
            </div>
        </div>
    );
};
