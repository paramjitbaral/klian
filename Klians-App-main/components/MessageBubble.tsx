import React, { useState } from 'react';
import { Avatar } from './ui/Avatar';
import { ICONS } from '../constants';

interface SharedPost {
  _id: string;
  user: {
    name: string;
    email: string;
    profilePicture: string;
  };
  content?: string;
  image?: string;
  createdAt: string;
}

interface MessageBubbleProps {
  message: {
    type: 'text' | 'post' | 'image' | 'file';
    sender?: {
      name: string;
      profilePicture: string;
    };
    content?: string;
    text?: string;
    postId?: SharedPost;
    createdAt: string;
    timestamp?: string;
  };
  isOwnMessage: boolean;
  showSenderInfo?: boolean;
  onDelete?: () => void;
}

const parseMarkdownToHTML = (text: string): string => {
  if (!text) return '';
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

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwnMessage, showSenderInfo = false, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isPostMessage = message.type === 'post' && message.postId;
  const post = isPostMessage ? message.postId : null;
  const hasContent = post?.content && post.content.trim();
  const postAuthor = post?.user;

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isEmojiOnly = (text: string) => {
    if (!text) return false;
    const emojiRegex = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]|[\s])*$/;
    return emojiRegex.test(text.trim());
  };

  const onlyEmoji = message.type === 'text' && isEmojiOnly(message.content || message.text || '');

  return (
    <div className={`flex flex-col mb-3 ${isOwnMessage ? 'items-end' : 'items-start'}`}>
      <div 
        className={`flex items-end gap-2 max-w-[85%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
        onMouseEnter={() => isOwnMessage && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {!isOwnMessage && message.sender && (
          <Avatar src={message.sender.profilePicture} alt={message.sender.name} size="sm" />
        )}

        <div className="relative group flex items-end gap-2">
          {isOwnMessage && isHovered && (
            <button
              onClick={onDelete}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 transition-all duration-200 border border-red-200 dark:border-red-800 shadow-sm"
              title="Delete message"
            >
              <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 3v1H4v2h1v13c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V6h1V4h-5V3H9zm0 5h2v8H9V8zm4 0h2v8h-2V8z" />
              </svg>
            </button>
          )}

          <div
            className={`transition-all duration-200 ${
              message.type === 'text' 
                ? (onlyEmoji ? 'bg-transparent' : 'px-4 py-2 rounded-2xl shadow-sm') 
                : 'rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700'
            } ${
              isOwnMessage
                ? (onlyEmoji ? 'text-right' : 'bg-blue-600 text-white rounded-br-none')
                : (onlyEmoji ? 'text-left' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none')
            }`}
          >
            {showSenderInfo && !isOwnMessage && message.sender && (
              <p className="font-bold text-[10px] uppercase tracking-wider mb-1 text-red-500 dark:text-red-400">{message.sender.name}</p>
            )}
            
            {message.type === 'image' ? (
              <div className="relative">
                <img src={message.content || message.text} alt="Attachment" className="max-w-full h-auto max-h-80 object-cover cursor-pointer" onClick={() => window.open(message.content || message.text, '_blank')} />
                <div className="p-2 flex justify-between items-center bg-black/20 backdrop-blur-md">
                  <span className="text-[9px] text-white font-medium uppercase tracking-widest">{formatTime(message.timestamp || message.createdAt)}</span>
                </div>
              </div>
            ) : message.type === 'file' ? (
              <div className="p-3 flex items-center gap-3 min-w-[220px] bg-white dark:bg-slate-900">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">{ICONS.attachment}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate dark:text-white uppercase tracking-tighter">Document</p>
                  <a href={message.content || message.text} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 font-semibold hover:underline">Download Attachment</a>
                </div>
              </div>
            ) : isPostMessage && post ? (
                <div className="space-y-0 w-full max-w-sm">
                    {postAuthor && (
                    <div className="bg-slate-50 dark:bg-slate-900 px-3 py-2 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
                        <Avatar src={postAuthor.profilePicture} alt={postAuthor.name} size="xs" />
                        <p className="font-bold text-[11px] text-slate-900 dark:text-white truncate uppercase tracking-tight">{postAuthor.name}</p>
                    </div>
                    )}
                    {post.image && <img src={post.image} alt="Post" className="w-full h-auto object-cover" />}
                    {hasContent && (
                    <div className="bg-slate-50 dark:bg-slate-900 px-3 py-2">
                        <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">{post.content}</p>
                    </div>
                    )}
                </div>
            ) : (
              <div className={onlyEmoji ? '' : 'p-0'}>
                <p
                  className={`${onlyEmoji ? 'text-5xl' : 'text-[14px] leading-relaxed'} break-words`}
                  dangerouslySetInnerHTML={{ __html: parseMarkdownToHTML(message.content || message.text || '') }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      <span className={`text-[10px] mt-1 font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest ${isOwnMessage ? 'mr-1' : 'ml-11'}`}>
        {formatTime(message.timestamp || message.createdAt)}
      </span>
    </div>
  );
};