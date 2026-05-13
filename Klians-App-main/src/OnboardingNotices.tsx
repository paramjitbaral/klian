import React from 'react';

interface OnboardingNoticesProps {
  unreadNotices: Array<{ id: string; title: string; body: string }>;
  onMarkAllRead: () => void;
}

export const OnboardingNotices: React.FC<OnboardingNoticesProps> = ({ unreadNotices, onMarkAllRead }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.7)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
    }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 320, maxWidth: 480 }}>
        <h2 style={{ marginBottom: 16 }}>Unread Notices</h2>
        <ul style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 24 }}>
          {unreadNotices.map(notice => (
            <li key={notice.id} style={{ marginBottom: 16 }}>
              <strong>{notice.title}</strong>
              <div>{notice.body}</div>
            </li>
          ))}
        </ul>
        <button
          style={{ padding: '10px 24px', background: '#007bff', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}
          onClick={onMarkAllRead}
        >
          Mark All as Read & Continue
        </button>
      </div>
    </div>
  );
}
