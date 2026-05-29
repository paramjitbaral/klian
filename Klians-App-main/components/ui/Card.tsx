import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', hoverable = true }) => {
  const hoverClass = hoverable ? 'transition-shadow duration-200 shadow-sm hover:shadow-md' : 'shadow-sm';

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 ${hoverClass} ${className}`}>
      {/* Padding is left to consumers to allow edge-to-edge media when needed. */}
      {children}
    </div>
  );
};
