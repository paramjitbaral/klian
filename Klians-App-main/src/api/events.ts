import API from './index';

// Events API services
export const eventsAPI = {
  // Get all events
  getEvents: () => {
    return API.get('/events');
  },
  
  // Get a single event by ID
  getEvent: (eventId: string) => {
    return API.get(`/events/${eventId}`);
  },
  
  // Create a new event
  createEvent: (eventData: any) => {
    return API.post('/events', eventData);
  },
  
  // Update an event
  updateEvent: (eventId: string, eventData: any) => {
    return API.put(`/events/${eventId}`, eventData);
  },
  
  // Delete an event
  deleteEvent: (eventId: string) => {
    return API.delete(`/events/${eventId}`);
  },
  
  // Attend an event
  attendEvent: (eventId: string) => {
    return API.put(`/events/attend/${eventId}`);
  },
  
  // Unattend an event
  unattendEvent: (eventId: string) => {
    return API.put(`/events/unattend/${eventId}`);
  },

  // Toggle reminder for an event
  toggleReminder: (eventId: string, enabled: boolean) => {
    return API.put(`/events/reminder/${eventId}`, { enabled });
  }
};

export default eventsAPI;