import React from 'react';

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  className?: string;
}

// Avatar sizes follow the visual spec: sm=32px (h-8), md=40px (h-10), lg=64px (h-16), xl=48px (h-12)
export const Avatar: React.FC<AvatarProps> = ({ src, alt, size = 'md', online = false, className = '' }) => {
  const [imageError, setImageError] = React.useState(false);
  
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-xl',
    xl: 'h-12 w-12 text-base'
  };

  // Handle empty strings by converting to null
  let imageSrc = src && src.trim() ? src : null;
  
  // Prepend backend URL if it's a relative path
  if (imageSrc && !imageSrc.startsWith('data:') && !imageSrc.startsWith('http')) {
    imageSrc = `http://localhost:5000${imageSrc}`;
  }
  
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
    <div className={`relative inline-block ${className}`}>
      {imageSrc && !imageError ? (
        <img
          src={imageSrc}
          alt={alt}
          className={`rounded-full object-cover ${sizeClasses[size]}`}
          onError={() => setImageError(true)}
        />
      ) : (
        <div className={`rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-semibold text-white ${sizeClasses[size]}`}>
          {getInitials(alt)}
        </div>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
      )}
    </div>
  );
};