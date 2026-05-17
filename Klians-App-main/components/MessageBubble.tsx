import React, { useState } from 'react';
import { Avatar } from './ui/Avatar';
import { ICONS } from '../constants';
import { useNavigate } from 'react-router-dom';

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
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isEmojiOnly = (text: string) => {
    if (!text) return false;
    const emojiRegex = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]|[\s])*$/;
    return emojiRegex.test(text.trim());
  };

  const getFullUrl = (url: string | null | undefined) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `http://localhost:5000${url}`;
  };

  const extractFileName = (url: string) => {
    if (!url) return 'Document';
    const parts = url.split('/');
    const fullFileName = parts[parts.length - 1];
    // Remove unique suffix if present (e.g., "-1778999000980-799104069.pdf")
    const cleanName = fullFileName.replace(/-[0-9]+-[0-9]+(?=\.[a-zA-Z0-9]+$)/, '');
    return cleanName.replace(/_/g, ' ');
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
          <Avatar src={message.sender.profilePicture} alt={message.sender.name} size="sm" />
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
            className={`transition-all duration-200 ${message.type === 'text'
              ? (onlyEmoji ? 'bg-transparent' : 'px-3.5 py-2 rounded-2xl shadow-sm')
              : 'rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700'
              } ${isOwnMessage
                ? (onlyEmoji ? 'text-right' : 'bg-blue-600 text-white rounded-br-none')
                : (onlyEmoji ? 'text-left' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none')
              }`}
          >
            {showSenderInfo && !isOwnMessage && message.sender && (
              <div className={message.type !== 'text' ? 'px-3.5 pt-2.5 pb-1.5' : 'mb-1'}>
                <p className="font-bold text-[10px] uppercase tracking-wider text-red-500 dark:text-red-400">{message.sender.name}</p>
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
              <div className="relative bg-black rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 max-w-sm">
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
              <div className="p-4 flex items-center gap-4 min-w-[280px] bg-white dark:bg-slate-900 border-l-4 border-blue-500 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 shadow-inner">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-900 dark:text-white truncate uppercase tracking-tighter mb-0.5" title={extractFileName(message.content || message.text || '')}>
                    {extractFileName(message.content || message.text || '')}
                  </p>
                  <a
                    href={getFullUrl(message.content || message.text)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-500 font-bold hover:text-blue-600 flex items-center gap-1 transition-colors"
                  >
                    Download File
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                </div>
              </div>
            ) : isPostMessage && post ? (
              <div className="flex flex-col w-full max-w-sm bg-white dark:bg-slate-900 shadow-md border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden group">
                <div className="p-3 flex items-center justify-between border-b border-slate-50 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Avatar src={getFullUrl(postAuthor?.profilePicture)} alt={postAuthor?.name || 'User'} size="xs" />
                    <div>
                      <p className="font-black text-[11px] text-slate-900 dark:text-white uppercase tracking-tight leading-none">{postAuthor?.name}</p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5">Shared Post</p>
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                </div>

                {post.image && (() => {
                  const mediaUrl = getFullUrl(post.image);
                  const fileType = getFileType(post.image);
                  if (fileType === 'image') {
                    return (
                      <div className="relative overflow-hidden bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                        <img
                          src={mediaUrl}
                          alt="Shared post media"
                          className="w-full h-auto group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      </div>
                    );
                  } else if (fileType === 'video') {
                    return (
                      <div className="relative bg-black flex items-center justify-center">
                        <video src={mediaUrl} controls className="w-full h-auto" />
                      </div>
                    );
                  } else if (fileType === 'doc') {
                    return (
                      <div className="p-3 flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 border-y border-slate-100 dark:border-slate-700">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tighter truncate">{extractFileName(post.image)}</p>
                          <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-500 font-bold hover:underline flex items-center gap-1">
                            Download File
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </a>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {hasContent && (
                  <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30">
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic line-clamp-2">
                      "{post.content}"
                    </p>
                  </div>
                )}

                <button
                  onClick={handleViewPost}
                  className="w-full px-4 py-2 flex items-center justify-between bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">View Full Post</span>
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className={onlyEmoji ? '' : 'p-0'}>
                <p
                  className={`${onlyEmoji ? 'text-5xl' : 'text-[13px] leading-relaxed'} break-words`}
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