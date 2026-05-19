import React from 'react';
import { resolveBackendUrl } from '@/src/api/config';

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  className?: string;
}

// Avatar sizes follow the visual spec: sm=32px (h-8), md=40px (h-10), lg=64px (h-16), xl=48px (h-12)
export const Avatar: React.FC<AvatarProps> = ({ src, alt, size = 'md', online = false, className = '' }) => {
  const [imageError, setImageError] = React.useState(false);
  
  const sizeClasses = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-xl',
    xl: 'h-12 w-12 text-base'
  };

  const imageSrc = resolveBackendUrl(src);
  
  // Get initials from alt text
  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string') return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className={`relative inline-block flex-shrink-0 rounded-full ${sizeClasses[size]} ${className}`}>
      {imageSrc && !imageError ? (
        <img
          src={imageSrc}
          alt={alt}
          className="rounded-full object-cover w-full h-full"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-semibold text-white w-full h-full">
          {getInitials(alt)}
        </div>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
      )}
    </div>
  );
};