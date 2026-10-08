/**
 * Generate a SHA-256 hash of a File object using the Web Crypto API.
 * Returns lowercase hex string.
 */
export const generateSHA256 = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Format a date value into a human-readable string.
 */
export const formatDate = (date: string | Date | number): string => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

/**
 * Build the full URL for a user's profile picture stored in /uploads.
 */
export const getProfilePictureUrl = (
  profilePicture: string | null | undefined,
  email: string
): string => {
  if (profilePicture) {
    // Always serve from /uploads/<filename>, never from /api/../uploads/
    const rawApiUrl = import.meta.env.VITE_API_URL || '';
    const base = rawApiUrl
      ? rawApiUrl.replace(/\/api\/?$/, '')
      : typeof window !== 'undefined'
        ? window.location.origin
        : '';
    return base ? `${base}/uploads/${profilePicture}` : `/uploads/${profilePicture}`;
  }
  // Fallback avatar seeded by email so it's consistent per user.
  return `https://picsum.photos/seed/${encodeURIComponent(email)}/100/100`;
};
