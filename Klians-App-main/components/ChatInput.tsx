import React, { useState, useRef } from 'react';
import { ICONS } from '../constants';
import { EmojiPicker } from './EmojiPicker';
import { messagesAPI } from '../src/api/messages';

const SendIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>;

interface ChatInputProps {
    onSendMessage: (message: string, type?: 'text' | 'image' | 'file') => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage }) => {
    const [message, setMessage] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const handleInput = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            const scrollHeight = textarea.scrollHeight;
            textarea.style.height = `${scrollHeight}px`;
        }
    };

    const handleSendMessage = () => {
        if (message.trim()) {
            onSendMessage(message.trim(), 'text');
            setMessage('');
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
            setShowEmojiPicker(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleEmojiSelect = (emoji: string) => {
        setMessage(prev => prev + emoji);
        textareaRef.current?.focus();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsUploading(true);
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await messagesAPI.uploadFile(formData);
            const { url, type } = response.data;
            
            onSendMessage(url, type);
        } catch (error) {
            console.error('File upload failed:', error);
            alert('Failed to upload file. Please try again.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 relative">
            {showEmojiPicker && (
                <EmojiPicker 
                    onSelect={handleEmojiSelect} 
                    onClose={() => setShowEmojiPicker(false)} 
                />
            )}
            
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileChange}
                accept="image/*,.pdf,.doc,.docx,.txt"
            />

            <div className="flex items-end gap-3">
                <div className="flex-1 flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-700 rounded-2xl transition-all focus-within:ring-2 focus-within:ring-red-500 focus-within:bg-white dark:focus-within:bg-slate-600">
                    <button 
                        className={`transition-colors flex-shrink-0 ${showEmojiPicker ? 'text-red-500' : 'text-slate-500 dark:text-slate-400 hover:text-red-500'}`} 
                        type="button"
                        title="Emoji"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    >
                        {ICONS.smile}
                    </button>
                    <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onInput={handleInput}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        placeholder="Message..."
                        className="flex-1 bg-transparent outline-none text-sm resize-none max-h-32 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                    />
                    <button 
                        className={`text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors flex-shrink-0 ${isUploading ? 'animate-spin' : ''}`} 
                        type="button"
                        title="Attachment"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                    >
                        {isUploading ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        ) : ICONS.attachment}
                    </button>
                </div>
                <button
                    onClick={handleSendMessage}
                    disabled={!message.trim() || isUploading}
                    className="w-11 h-11 flex items-center justify-center rounded-full bg-gradient-to-tr from-red-500 to-pink-500 text-white shadow-lg shadow-red-500/30 hover:scale-105 active:scale-95 disabled:grayscale disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0"
                    type="button"
                    title="Send"
                >
                    <SendIcon />
                </button>
            </div>
        </div>
    );
};
