import React from 'react';
import { Post } from '../types';
import { Avatar } from './ui/Avatar';
import { Card } from './ui/Card';

interface PostCardProps {
  post: Post;
}

const LikeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.5l1.318-1.182a4.5 4.5 0 116.364 6.364L12 20.036l-7.682-7.682a4.5 4.5 0 010-6.364z" /></svg>;
const CommentIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
const ShareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6.002l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" /></svg>;


export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const timeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
  };
    
  return (
    <Card className="mb-6">
      <div className="flex items-start space-x-4 p-4">
        <Avatar src={post.author.avatar} alt={post.author.name} />
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <p className="font-semibold text-slate-900 dark:text-slate-100">{post.author.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">@{post.author.username}</p>
            <span className="text-slate-400 dark:text-slate-500">·</span>
            <p className="text-sm text-slate-500 dark:text-slate-400">{timeAgo(post.timestamp)}</p>
          </div>
          <p className="mt-2 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{post.content}</p>
          {post.image && (
            <div className="mt-3">
              <img src={post.image} alt={post.imageDescription || 'Post image'} className="w-full rounded-xl object-cover" />
            </div>
          )}
          <div className="mt-4 flex items-center justify-between text-slate-500 dark:text-slate-400">
             <button className="flex items-center space-x-2 hover:text-red-500 transition-colors">
                <LikeIcon />
                <span>{post.likes}</span>
             </button>
             <button className="flex items-center space-x-2 hover:text-blue-500 transition-colors">
                <CommentIcon />
                <span>{post.comments}</span>
             </button>
             <button className="flex items-center space-x-2 hover:text-green-500 transition-colors">
                <ShareIcon />
                <span>Share</span>
             </button>
          </div>
        </div>
      </div>
    </Card>
  );
};
