import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '../constants';
import { Event, Role } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { EventCard } from '../components/EventCard';
import { Input } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../contexts/SocketContext';
import { eventsAPI } from '../src/api/events';

const EventCardSkeleton: React.FC = () => (
  <Card className="bg-white dark:bg-slate-800 p-6 animate-pulse">
    <div className="flex items-start gap-4">
      <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      <div className="flex-1 space-y-3">
        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
      </div>
    </div>
  </Card>
);

const Calendar: React.FC<{
  currentDate: Date;
  changeMonth: (delta: number) => void;
  selectedDate: Date | null;
  onDateChange: (date: Date) => void;
  eventDays: Set<number>;
  reminderDays: Set<number>;
}> = ({ currentDate, changeMonth, selectedDate, onDateChange, eventDays, reminderDays }) => {
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const today = new Date();
  const isCurrentMonthInView = today.getFullYear() === currentYear && today.getMonth() === currentMonth;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  return (
    <div className="select-none">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">
          {monthName} <span className="text-slate-400 font-medium">{currentYear}</span>
        </h3>
        <div className="flex gap-1">
          <button 
            onClick={() => changeMonth(-1)} 
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {ICONS.chevronLeft}
          </button>
          <button 
            onClick={() => changeMonth(1)} 
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {ICONS.chevronRight}
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
          <div key={`${day}-${idx}`} className="font-bold text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest py-2">
            {day}
          </div>
        ))}
        {emptyDays.map(d => <div key={`empty-${d}`} className="h-10 w-10 sm:h-9 sm:w-9" />)}
        {days.map(day => {
          const date = new Date(currentYear, currentMonth, day);
          const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
          const isToday = isCurrentMonthInView && day === today.getDate();
          const hasEvent = eventDays.has(day);
          const isReminder = reminderDays.has(day);
          const dateStr = date.toISOString().split('T')[0];

          return (
            <div key={day} className="flex justify-center items-center">
              <button
                onClick={() => onDateChange(date)}
                className={`
                  h-10 w-10 sm:h-9 sm:w-9 rounded-xl flex flex-col items-center justify-center relative text-xs
                  transition-all duration-200 
                  ${isSelected 
                    ? 'bg-red-600 text-white font-bold shadow-lg shadow-red-200 dark:shadow-none scale-105' 
                    : isToday 
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold' 
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }
                `}
              >
                <span>{day}</span>
                {hasEvent && !isSelected && (
                  <span className="absolute bottom-1.5 h-1 w-1 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const EventsPage: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [events, setEvents] = useState<Event[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [reminders, setReminders] = useState<Set<string>>(new Set());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();
  
  // Fetch events from database
  useEffect(() => {
    const fetchEvents = async () => {
      if (!user) return;
      setIsLoading(true);
      
      try {
        const response = await eventsAPI.getEvents();
        setEvents(response.data);
      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEvents();
  }, [user]);
  
  // Listen for real-time event updates
  useEffect(() => {
    if (!socket) return;
    
    socket.on('new-event', (newEvent) => {
      setEvents(prevEvents => [newEvent, ...prevEvents]);
      setIsCreating(false); // Clear skeleton when event arrives
    });
    
    socket.on('event-deleted', (deletedEventId) => {
      setEvents(prevEvents => prevEvents.filter(e => 
        (e.id || e._id) !== deletedEventId
      ));
    });
    
    socket.on('event-updated', (updatedEvent) => {
      setEvents(prevEvents => 
        prevEvents.map(e => 
          (e.id || e._id) === (updatedEvent.id || updatedEvent._id) 
            ? updatedEvent 
            : e
        )
      );
    });
    
    return () => {
      socket.off('new-event');
      socket.off('event-deleted');
      socket.off('event-updated');
    };
  }, [socket]);

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
        navigate(-1);
    } else {
        navigate('/home', { replace: true });
    }
  };

  const handleDeleteEvent = (eventId: string) => {
    setEvents(prevEvents => prevEvents.filter(e => (e.id || e._id) !== eventId));
  };

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const changeMonth = (delta: number) => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setDate(1); // Avoid issues with different month lengths
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  const toggleReminder = (eventId: string) => {
    setReminders(prev => {
        const newReminders = new Set(prev);
        if (newReminders.has(eventId)) {
            newReminders.delete(eventId);
        } else {
            newReminders.add(eventId);
        }
        return newReminders;
    });
  };

  const eventDaysInView = useMemo(() => {
    return new Set(
      events
        .map(e => new Date(e.date))
        .filter(d => d.getMonth() === currentMonth && d.getFullYear() === currentYear)
        .map(d => d.getDate())
    );
  }, [events, currentMonth, currentYear]);
  
  const reminderDaysInView = useMemo(() => {
    return new Set(
      events
        .filter(e => reminders.has(e.id))
        .map(e => new Date(e.date))
        .filter(d => d.getMonth() === currentMonth && d.getFullYear() === currentYear)
        .map(d => d.getDate())
    );
  }, [events, reminders, currentMonth, currentYear]);

  const filteredEvents = useMemo(() => {
    if (!selectedDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return events
            .filter(event => new Date(event.date) >= today)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return events.filter(event => new Date(event.date).toDateString() === selectedDate.toDateString());
  }, [events, selectedDate]);

  const handleCreateEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    
    const formData = new FormData(e.currentTarget);
    const datePart = formData.get('dateOnly') as string;
    
    const hour = formData.get('hour') as string;
    const minute = formData.get('minute') as string;
    const period = formData.get('period') as string;
    
    let hourNum = parseInt(hour);
    if (period === 'PM' && hourNum < 12) hourNum += 12;
    if (period === 'AM' && hourNum === 12) hourNum = 0;
    
    const formattedHour = hourNum < 10 ? `0${hourNum}` : hourNum;
    const timePart = `${formattedHour}:${minute}`;
    
    const eventData = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      location: formData.get('location') as string || '',
      date: new Date(`${datePart}T${timePart}`).toISOString()
    };
    
    try {
      setIsModalOpen(false); // Close modal immediately
      setIsCreating(true); // Show skeleton
      await eventsAPI.createEvent(eventData);
      // The socket will handle adding the new event to the list
    } catch (error) {
      console.error('Error creating event:', error);
      setIsCreating(false); // Hide skeleton on error
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col overflow-y-auto sm:overflow-hidden lg:h-screen">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 sm:py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <button 
              onClick={handleBack} 
              className="p-2 -ml-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate">Events</h1>
              <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">Coordinate and discover upcoming university events</p>
            </div>
          </div>
          
          {(user?.role === Role.TEACHER || user?.role === Role.ADMIN) && (
            <Button onClick={() => setIsModalOpen(true)} className="rounded-lg shadow-lg shadow-red-100 dark:shadow-none whitespace-nowrap !px-5 sm:!px-6 !py-1.5 text-xs sm:text-sm font-bold tracking-wide flex-shrink-0">
              Create
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto sm:overflow-hidden scrollbar-hide">
        <div className="max-w-7xl mx-auto h-full grid grid-cols-1 lg:grid-cols-12 gap-0 lg:divide-x divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-800 lg:bg-transparent lg:dark:bg-transparent">
          
          {/* Left Column - Sidebar/Calendar */}
          <div className="lg:col-span-4 p-3 sm:p-6 bg-white dark:bg-slate-800 lg:bg-transparent flex flex-col gap-6 lg:overflow-y-auto scrollbar-hide">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
              <Calendar 
                currentDate={currentDate}
                changeMonth={changeMonth}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                eventDays={eventDaysInView}
                reminderDays={reminderDaysInView}
              />
            </div>
            
            {selectedDate && (
              <button 
                onClick={() => setSelectedDate(null)}
                className="text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 uppercase tracking-widest text-center py-2 transition-colors"
              >
                Reset Calendar View
              </button>
            )}
          </div>
          
          {/* Right Column - Events Content */}
          <div className="lg:col-span-8 bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 sm:p-6 flex flex-col lg:overflow-hidden">
            <div className="mb-4 sm:mb-6 flex items-center justify-center sm:justify-between gap-6 md:gap-8">
              <div className="flex flex-col min-w-0">
                <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {selectedDate ? (
                    <>Events for <span className="text-red-600 dark:text-red-400">{selectedDate.toLocaleDateString('default', { day: 'numeric', month: 'long' })}</span></>
                  ) : "Upcoming Events"}
                </h2>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>{filteredEvents.length} Events Found</span>
                </div>
              </div>

              <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-fit flex-shrink-0">
                <button 
                  onClick={() => setSelectedDate(null)}
                  className={`px-3 py-1 sm:px-4 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${!selectedDate ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  Upcoming
                </button>
                <button 
                  onClick={() => {
                    const t = new Date();
                    t.setHours(0,0,0,0);
                    setSelectedDate(t);
                  }}
                  className={`px-3 py-1 sm:px-4 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${selectedDate?.toDateString() === new Date().toDateString() ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  Today
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide pb-10">
              {isLoading ? (
                <div className="grid grid-cols-1 gap-4">
                  {[1, 2, 3].map((i) => (
                    <EventCardSkeleton key={`event-skeleton-${i}`} />
                  ))}
                </div>
              ) : isCreating ? (
                <EventCardSkeleton />
              ) : filteredEvents.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {filteredEvents.map((event) => (
                    <EventCard 
                      key={event.id || event._id} 
                      event={event} 
                      isReminderSet={reminders.has(event.id || event._id)} 
                      onToggleReminder={toggleReminder}
                      onDelete={handleDeleteEvent}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-center px-6">
                  <div className="w-16 h-16 mb-6 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No events scheduled</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[280px] font-medium leading-relaxed">
                    The calendar is looking a bit empty. Check back soon or be the one to start something new!
                  </p>
                  {(user?.role === Role.TEACHER || user?.role === Role.ADMIN) && (
                    <Button 
                      variant="secondary" 
                      onClick={() => setIsModalOpen(true)} 
                      className="mt-6 font-bold"
                    >
                      Plan an Event
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Event" size="sm">
        <form onSubmit={handleCreateEvent} className="space-y-3 md:space-y-4">
          <Input name="title" label="Event Title *" placeholder="e.g., Summer Summit" required />
          <Input name="description" label="Description *" placeholder="What's happening?" required />
          <Input name="location" label="Location" placeholder="e.g., Campus Plaza (Optional)" />
          <div className="grid grid-cols-2 gap-3">
            <Input 
              name="dateOnly" 
              label="Event Date *" 
              type="date" 
              required 
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch (err) {
                  console.warn('showPicker failed', err);
                }
              }}
              onKeyDown={(e) => e.preventDefault()}
              className="cursor-pointer"
              style={{ colorScheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }}
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            />
            <div className="w-full">
              <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-0.5">Event Time</label>
              <div className="grid grid-cols-3 gap-1.5">
                <select 
                  name="hour"
                  className="w-full px-1 py-2 md:py-3 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors appearance-none text-center cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                    <option key={h} value={h < 10 ? `0${h}` : h}>{h}</option>
                  ))}
                </select>
                <select 
                  name="minute"
                  className="w-full px-1 py-2 md:py-3 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors appearance-none text-center cursor-pointer"
                >
                  {['00', '15', '30', '45'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select 
                  name="period"
                  className="w-full px-1 py-2 md:py-3 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors appearance-none text-center cursor-pointer"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2 md:pt-4">
            <Button type="submit" className="rounded-lg !px-8">Create</Button>
          </div>
        </form>
      </Modal>
      <div className="h-20 md:hidden" /> {/* Spacer for bottom nav */}
    </div>
  );
};