import React from 'react';
import { Broadcast } from '../types';
import { ICONS } from '../constants';
import { Card } from './ui/Card';

const useTimeAgo = (date: string | number | Date) => {
  const [time, setTime] = React.useState('...');

  React.useEffect(() => {
    const parseDate = (value: string | number | Date) => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^\d+$/.test(trimmed)) {
          return new Date(Number(trimmed));
        }
      }
      return new Date(value);
    };

    const calculateTime = () => {
      if (!date) return "just now";
      const d = parseDate(date);
      if (isNaN(d.getTime())) return "just now";

      const now = new Date();
      const diffSeconds = (now.getTime() - d.getTime()) / 1000;
      const seconds = Math.max(0, Math.floor(diffSeconds));

      if (seconds < 60) return "just now";

      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;

      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;

      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;

      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    setTime(calculateTime());
    const interval = setInterval(() => setTime(calculateTime()), 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [date]);

  return time;
};

const PinBadge: React.FC = () => (
  <div className="absolute top-2 right-2 md:top-3 md:right-3 flex items-center gap-1 md:gap-1.5 px-2 py-0.5 md:px-3 md:py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[10px] md:text-xs font-bold uppercase tracking-wider z-10">
    {ICONS.pinSolid ? React.cloneElement(ICONS.pinSolid, { className: "h-2.5 w-2.5 md:h-3 md:w-3" }) : null}
    <span>Pinned</span>
  </div>
);

export const BroadcastCard: React.FC<{ broadcast: Broadcast; isPinned: boolean }> = ({ broadcast, isPinned }) => {
  const timeDisplay = useTimeAgo(broadcast.timestamp);

  return (
    <div className="p-4 mb-4 bg-red-50 dark:bg-red-900/10 rounded-xl border-l-4 border-red-500 shadow-sm hover:shadow-md transition-shadow relative">
      {isPinned && <PinBadge />}
      <div className="flex items-start gap-3 md:gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 bg-red-500 rounded-full flex items-center justify-center mt-0.5">
            {React.cloneElement(ICONS.broadcast, { className: "w-5 h-5 text-white"})}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h3 className={`font-bold text-[15px] md:text-[16px] text-slate-900 dark:text-slate-100 truncate ${isPinned ? 'pr-16' : ''}`}>
                {broadcast.title}
            </h3>

            {/* Description */}
            <p className="text-[13px] md:text-[14px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                {broadcast.content}
            </p>

            {/* Sender & Target */}
            <div className="flex items-center justify-between mt-2.5 text-[11px] md:text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                    <span className="font-semibold">By {broadcast.author.name}</span>
                    <span>•</span>
                    <span>{timeDisplay}</span>
                </div>
            </div>
          </div>
      </div>
    </div>
  );
};