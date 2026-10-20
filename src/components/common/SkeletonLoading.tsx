import React from 'react';

export const ChatListSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="divide-y divide-[#222e35]/30">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3.5 py-3 animate-pulse">
          {/* Avatar Skeleton */}
          <div className="w-12 h-12 rounded-full bg-[#202c33]/70 flex-shrink-0" />
          {/* Content Skeleton */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-3.5 bg-[#202c33] rounded-md w-28" />
              <div className="h-2.5 bg-[#202c33]/60 rounded-md w-10" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-3 bg-[#202c33]/60 rounded-md w-44" />
              <div className="w-4 h-4 rounded-full bg-[#202c33]/40" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const MessageListSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: count }).map((_, i) => {
        const isRight = i % 2 !== 0;
        return (
          <div
            key={i}
            className={`flex ${isRight ? 'justify-end' : 'justify-start'} animate-pulse`}
          >
            <div
              className={`rounded-2xl p-3.5 ${
                isRight ? 'bg-[#005c4b]/50 w-56 rounded-br-xs' : 'bg-[#202c33]/70 w-64 rounded-bl-xs'
              } space-y-2`}
            >
              <div className="h-3 bg-white/20 rounded w-3/4" />
              <div className="h-2.5 bg-white/10 rounded w-1/2" />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const StatusListSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 p-2 animate-pulse">
          <div className="w-12 h-12 rounded-full bg-[#202c33] ring-2 ring-[#00a884]/40 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-[#202c33] rounded w-32" />
            <div className="h-2.5 bg-[#202c33]/60 rounded w-20" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const CallListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="divide-y divide-[#222e35]/30">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3.5 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#202c33] flex-shrink-0" />
            <div className="space-y-1.5">
              <div className="h-3.5 bg-[#202c33] rounded w-28" />
              <div className="h-2.5 bg-[#202c33]/60 rounded w-20" />
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#202c33]/50" />
        </div>
      ))}
    </div>
  );
};
