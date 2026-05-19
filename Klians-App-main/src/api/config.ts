export const getBackendUrl = () => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${hostname}:5000`;
};

export const resolveBackendUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  
  const trimmed = url.trim();
  if (trimmed.startsWith('data:')) return trimmed;
  
  const backendUrl = getBackendUrl();
  
  // Replace absolute localhost/127.0.0.1 references with the dynamically resolved backend URL
  if (trimmed.includes('localhost:5000') || trimmed.includes('127.0.0.1:5000')) {
    return trimmed.replace(/https?:\/\/(localhost|127\.0\.0\.1):5000/g, backendUrl);
  }
  
  // If it is a relative path (starts with / or has no protocol), prepend backend URL
  if (!trimmed.startsWith('http')) {
    const cleanUrl = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${backendUrl}${cleanUrl}`;
  }
  
  return trimmed;
};
