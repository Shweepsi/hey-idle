import React from 'react';
import { Button } from '@/components/ui/button';

interface AdProgressBarProps {
  dailyCount: number;
  maxDaily: number;
}

export function AdProgressBar({ dailyCount, maxDaily }: AdProgressBarProps) {
  const progressPercentage = (dailyCount / maxDaily) * 100;

  return (
    <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-orange-800">
              Publicités quotidiennes
            </span>
            <span className="text-xs font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              {dailyCount}/{maxDaily}
            </span>
          </div>
          <div className="w-full bg-orange-100 rounded-full h-2.5 overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500 transition-all duration-500 ease-out relative"
              style={{ width: `${progressPercentage}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
