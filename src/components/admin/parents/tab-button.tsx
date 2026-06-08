import React from 'react';
import { cn } from '@/lib/utils';

interface TabButtonProps {
  active: boolean;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

export default function TabButton({ active, label, icon: Icon, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all',
        active ? 'bg-[#161B22] text-white shadow-sm border border-white/5' : 'text-gray-500 hover:text-gray-300'
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
