// types.ts

export enum Role {
  STUDENT = 'Student',
  TEACHER = 'Teacher',
  DEAN = 'Dean',
  ADMIN = 'Admin',
}

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar: string;
  coverPhoto: string;
  bio: string;
  studentId?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  role: Role;
  createdAt: string;
  lastSeen?: string;
  followers?: number;
  following?: number;
}

export interface Post {
  id: string;
  author: User;
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  image?: string;
  imageDescription?: string;
  video?: string;
  videoThumbnail?: string;
  fileUrl?: string;
  isLiked?: boolean;
}

export interface Message {
  id: string;
  sender?: User; // Sender can be optional for system messages
  text: string;
  timestamp: string;
  read: boolean;
}

export interface Conversation {
  id: string;
  participants: User[];
  messages: Message[];
  unreadCount: number;
  isGroup: boolean;
  groupName?: string;
}

export interface GroupMessage {
  id: string;
  sender: User;
  text: string;
  timestamp: string;
}

export interface Group {
  id: string;
  name: string;
  avatar: string;
  members: User[];
  admins: string[];
  messages: GroupMessage[];
  description?: string;
  createdAt?: string;
}

export interface Event {
  id: string;
  _id?: string;
  title: string;
  description: string;
  location: string;
  date: string;
  creator: User;
  attendees: string[]; // User IDs
  isReminderSet?: boolean;
}

export interface Broadcast {
  id: string;
  title: string;
  content: string;
  author: User;
  target: Role | 'All';
  timestamp: string;
}


export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
}

export interface EmailParticipant {
  name: string;
  email: string;
  initial: string;
  color: string;
}

export interface Email {
  id: string;
  sender: EmailParticipant;
  recipient: EmailParticipant;
  subject: string;
  preview: string;
  body: string;
  timestamp: string;
  isRead: boolean;
}