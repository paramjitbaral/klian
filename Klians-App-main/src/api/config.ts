export const getBackendUrl = () => {
  // Prefer an explicit Vite env var in production (set VITE_BACKEND_URL on Cloudflare Pages)
  // @ts-ignore - import.meta.env is injected by Vite at build time
  const viteUrl = (import.meta as any)?.env?.VITE_BACKEND_URL;
  if (viteUrl) return viteUrl;

  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  
  // Detect local IP patterns: localhost, 127.0.0.1, 192.168.x.x, 10.x.x.x, 172.16-31.x.x
  const localIpPattern = /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/;
  const isLocalHost = localIpPattern.test(hostname);

  if (isLocalHost) {
    return `http://${hostname}:5000`;
  }

  // Production fallback: the backend runs on Render, not on the Pages domain.
  return 'https://klian.onrender.com';
};

export const resolveBackendUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  
  const trimmed = url.trim();
  if (trimmed.startsWith('data:')) return trimmed;
  
  const backendUrl = getBackendUrl();
  
  // Replace absolute local IP/localhost references with the dynamically resolved backend URL
  const localBackendRegex = /https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):5000/g;
  if (localBackendRegex.test(trimmed)) {
    return trimmed.replace(localBackendRegex, backendUrl);
  }
  
  // If it is a relative path (starts with / or has no protocol), prepend backend URL
  if (!trimmed.startsWith('http')) {
    const cleanUrl = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${backendUrl}${cleanUrl}`;
  }
  
  return trimmed;
};
