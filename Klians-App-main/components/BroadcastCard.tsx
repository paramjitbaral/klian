import React from 'react';
import { Broadcast } from '../types';
import { ICONS } from '../constants';
import { Card } from './ui/Card';

const useTimeAgo = (date: string | number | Date) => {
    const [time, setTime] = React.useState('...');

    React.useEffect(() => {
        const calculateTime = () => {
            if (!date) return "just now";
            const d = new Date(date);
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
    <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-bold uppercase tracking-wider z-10">
        {ICONS.pinSolid ? React.cloneElement(ICONS.pinSolid, { className: "h-3 w-3" }) : null}
        <span>Pinned</span>
    </div>
);

export const BroadcastCard: React.FC<{ broadcast: Broadcast; isPinned: boolean }> = ({ broadcast, isPinned }) => {
  const timeDisplay = useTimeAgo(broadcast.timestamp);

  return (
    <Card className="mb-4 relative overflow-hidden border-l-4 border-red-600 bg-red-50/30 dark:bg-red-900/10">
      {isPinned && <PinBadge />}
      <div className="flex items-start space-x-4 p-4">
          <div className="flex-shrink-0">
              <div className="bg-red-600 text-white rounded-full h-10 w-10 flex items-center justify-center ring-4 ring-red-100 dark:ring-red-900/30">
                {React.cloneElement(ICONS.broadcast, { className: "h-5 w-5"})}
              </div>
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-bold text-slate-900 dark:text-slate-100 ${isPinned ? 'pr-24' : ''}`}>{broadcast.title}</h3>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{broadcast.content}</p>
            <div className="mt-3 flex items-center justify-end text-right">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Sent by <span className="font-semibold">{broadcast.author.name}</span> &middot; {timeDisplay}
                </p>
            </div>
          </div>
      </div>
    </Card>
  );
};