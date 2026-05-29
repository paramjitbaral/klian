import React from 'react';
import { Avatar } from './ui/Avatar';
import DOMPurify from 'dompurify';

interface SharedPost {
  _id: string;
  content: string;
  user?: {
    name: string;
    email: string;
    profilePicture: string;
  };
  author?: {
    name: string;
    email: string;
    profilePicture: string;
  };
  image?: string;
  timestamp?: string;
  createdAt?: string;
  likes?: any[];
  comments?: any[];
}

interface SharedPostCardProps {
  post: SharedPost;
  message?: string;
}

const parseMarkdownToHTML = (text: string | undefined): string => {
  if (!text) return '';
  
  let escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  escapedText = escapedText
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/__(.*?)__/g, '<u>$1</u>');
    
  escapedText = escapedText.replace(/(#\w+)/g, '<a href="#" class="text-red-500 hover:underline">$1</a>');

  return escapedText;
};

export const SharedPostCard: React.FC<SharedPostCardProps> = ({ post, message }) => {
  // Use user field from Post model (fallback to author if available)
  const postAuthor = post.user || post.author;

  return (
    <div className="space-y-2 w-full max-w-sm">
      {/* Top Section - Author Info (Light Grey) */}
      <div className="bg-slate-100 dark:bg-slate-700 rounded-t-lg p-3 flex items-center gap-3">
        <Avatar 
          src={postAuthor?.profilePicture} 
          alt={postAuthor?.name} 
          size="sm"
        />
        <div>
          <p className="font-semibold text-sm text-slate-900 dark:text-white">
            {postAuthor?.name}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {postAuthor?.email}
          </p>
        </div>
      </div>

      {/* Middle Section - Post Image */}
      {post.image && (
        <div className="w-full">
          <img 
            src={post.image} 
            alt="Post content"
            className="w-full h-auto object-cover"
          />
        </div>
      )}

      {/* Bottom Section - Post Content (Light Grey) */}
      <div className="bg-slate-100 dark:bg-slate-700 rounded-b-lg p-3">
        <p 
          className="text-sm text-slate-900 dark:text-white line-clamp-3"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(parseMarkdownToHTML(post.content)) }}
        />
      </div>

      {/* Custom Message if exists */}
      {message && (
        <p className="text-sm text-slate-600 dark:text-slate-300 italic mt-2">
          "{message}"
        </p>
      )}
    </div>
  );
};
