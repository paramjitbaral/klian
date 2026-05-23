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
    <Card className="mb-3 md:mb-4 relative overflow-hidden border-l-[3px] md:border-l-4 border-red-600 bg-red-50/30 dark:bg-red-900/10">
      {isPinned && <PinBadge />}
      <div className="flex items-start space-x-3 md:space-x-4 p-3 md:p-4">
          <div className="flex-shrink-0 mt-0.5 md:mt-0">
              <div className="bg-red-600 text-white rounded-full h-8 w-8 md:h-10 md:w-10 flex items-center justify-center ring-[3px] md:ring-4 ring-red-100 dark:ring-red-900/30">
                {React.cloneElement(ICONS.broadcast, { className: "h-4 w-4 md:h-5 md:w-5"})}
              </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 truncate ${isPinned ? 'pr-16 md:pr-24' : ''}`}>{broadcast.title}</h3>
            <p className="mt-0.5 md:mt-1 text-xs md:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{broadcast.content}</p>
            <div className="mt-2 md:mt-3 flex items-center justify-end text-right">
                <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400">
                    Sent by <span className="font-semibold">{broadcast.author.name}</span> &middot; {timeDisplay}
                </p>
            </div>
          </div>
      </div>
    </Card>
  );
};