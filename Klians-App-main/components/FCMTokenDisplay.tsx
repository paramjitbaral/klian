import React from 'react';

interface FCMTokenDisplayProps {
  token: string | null;
}

const FCMTokenDisplay: React.FC<FCMTokenDisplayProps> = ({ token }) => {
  if (!token) return null;
  return (
    <div style={{ padding: '1rem', background: '#fff3cd', color: '#856404', border: '1px solid #ffeeba', borderRadius: '8px', margin: '1rem 0' }}>
      <strong>FCM Registration Token:</strong>
      <div style={{ wordBreak: 'break-all', marginTop: '0.5rem' }}>{token}</div>
      <small style={{ display: 'block', marginTop: '0.5rem' }}>
        Copy this token to test push notifications.
      </small>
    </div>
  );
};

export default FCMTokenDisplay;
