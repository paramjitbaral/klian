import React from 'react';
import { User } from '../types';
import { ICONS } from '../constants';
import { Avatar } from './ui/Avatar';
import { Card } from './ui/Card';

export interface CreatePostCardProps {
    user: User;
    onComposeClick: () => void;
    onComposeWithFile?: (file: File, type: 'image' | 'video' | 'document') => void;
}

export const CreatePostCard: React.FC<CreatePostCardProps> = ({ user, onComposeClick, onComposeWithFile }) => {
    const imageInputRef = React.useRef<HTMLInputElement>(null);
    const videoInputRef = React.useRef<HTMLInputElement>(null);
    const docInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'document') => {
        const file = e.target.files?.[0];
        if (file && onComposeWithFile) {
            onComposeWithFile(file, type);
        }
        e.target.value = '';
    };

    return (
        <Card className="mb-4">
            <div
                className="p-3 md:p-4 flex items-center gap-3 md:gap-4 cursor-pointer group"
                onClick={onComposeClick}
                role="button"
                aria-label="Create a new post"
            >
                <Avatar src={user.avatar} alt={user.name} size="md" className="flex-shrink-0" />

                <div className="flex-grow bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors rounded-full px-4 py-2.5 text-slate-500 dark:text-slate-400 text-sm font-medium truncate">
                    What's on your mind?
                </div>
            </div>

            <div className="flex items-center justify-around border-t border-slate-100 dark:border-slate-700/40 px-2 py-1">
                <button 
                    onClick={(e) => { e.stopPropagation(); imageInputRef.current?.click(); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                >
                    {React.cloneElement(ICONS.image, { className: "h-[18px] w-[18px] text-blue-500" })}
                    <span className="text-[13px] font-semibold">Photo</span>
                </button>
                <input type="file" ref={imageInputRef} onChange={(e) => handleFileChange(e, 'image')} accept="image/*" className="hidden" />

                <button 
                    onClick={(e) => { e.stopPropagation(); videoInputRef.current?.click(); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                >
                    {React.cloneElement(ICONS.video, { className: "h-[18px] w-[18px] text-rose-500" })}
                    <span className="text-[13px] font-semibold">Video</span>
                </button>
                <input type="file" ref={videoInputRef} onChange={(e) => handleFileChange(e, 'video')} accept="video/*" className="hidden" />

                <button 
                    onClick={(e) => { e.stopPropagation(); docInputRef.current?.click(); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                >
                    {React.cloneElement(ICONS.document, { className: "h-[18px] w-[18px] text-amber-500" })}
                    <span className="text-[13px] font-semibold hidden sm:inline">Document</span>
                    <span className="text-[13px] font-semibold sm:hidden">Doc</span>
                </button>
                <input type="file" ref={docInputRef} onChange={(e) => handleFileChange(e, 'document')} accept=".pdf,.doc,.docx,.txt" className="hidden" />
            </div>
        </Card>
    );
};
