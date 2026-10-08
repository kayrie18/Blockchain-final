import React, { useMemo } from 'react';
import { cn } from '../lib/utils';
import { User } from '../types';

interface AvatarProps {
  user: User | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const colors = [
  'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500',
  'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
  'bg-rose-500', 'bg-orange-500', 'bg-amber-500'
];

export const Avatar: React.FC<AvatarProps> = ({ user, size = 'md', className }) => {
  const { initials, colorClass } = useMemo(() => {
    if (!user || !user.name) return { initials: '?', colorClass: 'bg-slate-300' };
    
    // Extract up to 2 initials from the name
    const parts = user.name.trim().split(/\s+/);
    const i = parts.length > 1 
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : user.name.substring(0, 2).toUpperCase();

    // Assign a consistent color based on the email string hash
    const emailStr = user.email || user.name;
    let hash = 0;
    for (let j = 0; j < emailStr.length; j++) {
      hash = emailStr.charCodeAt(j) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    
    return { initials: i, colorClass: colors[idx] };
  }, [user]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-24 h-24 text-3xl sm:w-32 sm:h-32 sm:text-4xl lg:w-40 lg:h-40 lg:text-5xl border-8 border-white shadow-2xl'
  };

  return (
    <div 
      className={cn(
        'flex items-center justify-center font-black text-white shrink-0 object-cover bg-white',
        'rounded-2xl', // Matching existing square/rounded design language
        colorClass,
        sizeClasses[size],
        className
      )}
      title={user?.name || 'Avatar'}
    >
      {initials}
    </div>
  );
};
