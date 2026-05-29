import React, { useState } from 'react';
import { Avatar } from './ui/Avatar';
import { ICONS } from '../constants';
import { useNavigate } from 'react-router-dom';
import { resolveBackendUrl } from '@/src/api/config';
import DOMPurify from 'dompurify';

interface SharedPost {
  _id: string;
  id?: string;
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
    _id?: string;
    id?: string;
    type: 'text' | 'post' | 'image' | 'file' | 'video';
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
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isEmojiOnly = (text: string) => {
    if (!text) return false;
    const emojiRegex = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]|[\s])*$/;
    return emojiRegex.test(text.trim());
  };

  const getFullUrl = (url: string | null | undefined) => {
    return resolveBackendUrl(url);
  };

  const extractFileName = (rawUrl: string) => {
    if (!rawUrl) return 'Document';
    let url = rawUrl;
    
    try {
      if (url.includes('proxy-pdf') && url.includes('?url=')) {
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const proxyUrl = urlParams.get('url');
        if (proxyUrl) url = proxyUrl;
      }
    } catch (e) {
      // ignore
    }

    url = url.split('?')[0].split('#')[0];
    const urlFilename = url.split('/').pop() || 'Document';
    const nameParts = urlFilename.split('-');
    let realName = nameParts.length > 1 ? nameParts.slice(1).join('-') : urlFilename;
    
    if (realName.endsWith('.pdf.txt')) {
      realName = realName.replace('.pdf.txt', '.pdf');
    }
    
    return realName.replace(/_/g, ' ') || 'Document';
  };

  const navigate = useNavigate();

  const handleViewPost = () => {
    if (post) {
      navigate('/home', { state: { highlightPost: post._id || post.id } });
    }
  };

  const onlyEmoji = message.type === 'text' && isEmojiOnly(message.content || message.text || '');

  const getFileType = (url: string): 'image' | 'video' | 'doc' | 'other' => {
    if (!url) return 'other';
    const ext = url.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'image';
    if (['mp4', 'webm', 'ogg', 'mov'].includes(ext || '')) return 'video';
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'].includes(ext || '')) return 'doc';
    return 'other';
  };

  return (
    <div id={`message-${message._id || message.id || ''}`} className={`flex flex-col mb-3 ${isOwnMessage ? 'items-end' : 'items-start'}`}>
      <div
        className={`flex items-end gap-2 max-w-[85%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
        onMouseEnter={() => isOwnMessage && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {!isOwnMessage && message.sender && (
          <Avatar src={(message.sender as any).profilePicture || (message.sender as any).avatar} alt={message.sender.name} size="sm" />
        )}

        <div className="relative group flex items-end gap-2">
          {isOwnMessage && isHovered && (
            <button
              onClick={onDelete}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 transition-all duration-200 border border-red-200 dark:border-red-800 shadow-sm"
              title="Delete message"
            >
              <svg className="w-3.5 h-3.5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 3v1H4v2h1v13c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V6h1V4h-5V3H9zm0 5h2v8H9V8zm4 0h2v8h-2V8z" />
              </svg>
            </button>
          )}

          <div
            className={`transition-all duration-200 ${
              message.type === 'text'
                ? onlyEmoji
                  ? 'bg-transparent'
                  : `px-3.5 py-2 rounded-2xl shadow-sm ${isOwnMessage ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none'}`
                : message.type === 'image' || message.type === 'video'
                ? 'rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700'
                : 'bg-transparent'
            }`}
          >
            {showSenderInfo && !isOwnMessage && message.sender && (
              <div className={message.type !== 'text' ? 'px-3.5 pt-2.5 pb-1.5' : 'mb-0.5'}>
                <p className="font-bold text-[10px] uppercase tracking-wider text-red-500 dark:text-red-400 leading-none">{message.sender.name}</p>
              </div>
            )}

            {message.type === 'image' ? (
              <div className="relative group">
                <img
                  src={getFullUrl(message.content || message.text)}
                  alt="Attachment"
                  className="max-w-full h-auto max-h-80 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                  onClick={() => window.open(getFullUrl(message.content || message.text), '_blank')}
                />
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-white font-bold uppercase tracking-wider">Image Attachment</span>
                </div>
              </div>
            ) : message.type === 'video' ? (
              <div className="relative bg-black rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 max-w-[250px] xs:max-w-[280px] sm:max-w-sm">
                <video
                  src={getFullUrl(message.content || message.text)}
                  controls
                  className="w-full h-auto max-h-80"
                />
                <div className="p-2 bg-slate-900/90 flex justify-between items-center">
                  <span className="text-[10px] text-white font-bold uppercase tracking-widest px-2">Video File</span>
                </div>
              </div>
            ) : message.type === 'file' ? (
              <a 
                href={getFullUrl(message.content || message.text)} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-3 p-3 w-full max-w-[240px] sm:max-w-[280px] bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-xl transition-colors border border-slate-200/50 dark:border-slate-700/50"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-white truncate" title={extractFileName(message.content || message.text || '')}>
                    {extractFileName(message.content || message.text || '')}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Document</p>
                </div>
              </a>
            ) : isPostMessage && post ? (
              <div 
                onClick={handleViewPost}
                className="flex flex-col w-full max-w-[250px] xs:max-w-[280px] sm:max-w-[300px] bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
              >
                {/* Minimal Header */}
                <div className="px-3 py-2.5 flex items-center gap-2">
                  <Avatar src={getFullUrl(postAuthor?.profilePicture)} alt={postAuthor?.name || 'User'} size="xs" />
                  <p className="font-semibold text-[12.5px] text-slate-900 dark:text-white truncate">{postAuthor?.name}</p>
                </div>

                {/* Media (if any) */}
                {post.image && (() => {
                  const mediaUrl = getFullUrl(post.image);
                  const fileType = getFileType(post.image);
                  if (fileType === 'image') {
                    return (
                      <div className="w-full aspect-square bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden">
                        <img
                          src={mediaUrl}
                          alt="Post media"
                          className="w-full h-full object-cover"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      </div>
                    );
                  } else if (fileType === 'video') {
                    return (
                      <div className="w-full aspect-square bg-black flex items-center justify-center overflow-hidden">
                        <video src={mediaUrl} className="w-full h-full object-cover" />
                      </div>
                    );
                  } else if (fileType === 'doc') {
                    return (
                      <div className="px-3 py-4 flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                        <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{extractFileName(post.image)}</p>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Caption (if any) */}
                {hasContent && (
                  <div className="px-3 py-2.5 bg-white dark:bg-slate-900">
                    <p className="text-[13px] text-slate-800 dark:text-slate-200 line-clamp-2">
                      {post.content}
                    </p>
                  </div>
                )}
                
                {/* Minimal Footer indicator */}
                <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors">
                    <span className="text-[10px] font-medium uppercase tracking-wider">View Post</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>
              </div>
            ) : (
              <div className={onlyEmoji ? '' : 'p-0'}>
                <p
                  className={`${onlyEmoji ? 'text-5xl' : 'text-[13px] leading-relaxed'} break-words`}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(parseMarkdownToHTML(message.content || message.text || '')) }}
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
