import React from 'react';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = 'User',
  size = 'md',
  isOnline,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-24 h-24 text-2xl',
  };

  const badgeSizes = {
    sm: 'w-2.5 h-2.5 right-0 bottom-0 ring-1',
    md: 'w-3 h-3 right-0 bottom-0 ring-2',
    lg: 'w-3.5 h-3.5 right-0.5 bottom-0.5 ring-2',
    xl: 'w-5 h-5 right-1 bottom-1 ring-4',
  };

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

  return (
    <div className={`relative inline-block flex-shrink-0 ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center font-semibold bg-[#2a3942] text-[#d1d7db] shadow-inner select-none`}
      >
        <img
          src={src || defaultAvatar}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to text initials if image fails
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <span className="hidden">{initials}</span>
      </div>

      {isOnline !== undefined && (
        <span
          className={`absolute ${badgeSizes[size]} rounded-full ring-[#111b21] ${
            isOnline ? 'bg-[#00a884]' : 'bg-[#6b7c85]'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};
