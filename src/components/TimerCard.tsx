/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ActivityConfig, ActivityMode } from '../types';
import { Brain, Briefcase, Home, Dumbbell, Coffee, Moon } from 'lucide-react';

interface TimerCardProps {
  key?: React.Key | string;
  config: ActivityConfig;
  isActive: boolean;
  accumulatedMs: number;
  totalMs: number;
  onActivate: (mode: ActivityMode) => void;
}

export default function TimerCard({ 
  config, 
  isActive, 
  accumulatedMs, 
  totalMs, 
  onActivate 
}: TimerCardProps) {
  
  const percentage = totalMs > 0 ? (accumulatedMs / totalMs) * 100 : 0;

  // Format accumulated milliseconds into simple readable numbers
  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;

    const pad = (num: number) => num.toString().padStart(2, '0');

    if (h > 0) return `${pad(h)}h ${pad(m)}m`;
    if (m > 0) return `${pad(m)}m ${pad(s)}s`;
    return `${pad(s)}s`;
  };

  const getIcon = () => {
    const className = `h-4 w-4 ${isActive ? config.textClass : 'text-zinc-500 group-hover:text-zinc-400'}`;
    switch (config.mode) {
      case ActivityMode.STUDYING: return <Brain className={className} />;
      case ActivityMode.NOT_STUDYING: return <Coffee className={className} />;
    }
  };

  return (
    <button
      onClick={() => onActivate(config.mode)}
      disabled={isActive && config.mode === ActivityMode.NOT_STUDYING}
      className={`group w-full relative overflow-hidden bg-black/40 border rounded-xl p-3 flex flex-row items-center justify-between text-left transition-all duration-300 ${
        isActive 
          ? `bg-zinc-900/50 ${config.borderClass} shadow-[0_0_8px_rgba(16,185,129,0.15)]` 
          : 'border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/40'
      } ${isActive && config.mode === ActivityMode.NOT_STUDYING ? 'cursor-default' : 'cursor-pointer'}`}
      id={`timer-card-${config.mode}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Soft Background Highlight Box for Icon */}
        <div className={`p-1.5 rounded-lg flex-shrink-0 transition-all duration-300 ${
          isActive 
            ? `${config.bgClass}` 
            : 'bg-black border border-zinc-900 group-hover:bg-zinc-900/80'
        }`}>
          {getIcon()}
        </div>

        <div className="min-w-0">
          <span className="text-xs font-semibold text-zinc-100 block truncate">
            {config.label}
          </span>
          <span className={`text-[11px] font-mono font-medium ${isActive ? config.textClass : 'text-zinc-500'}`}>
            {formatTime(accumulatedMs)}
          </span>
        </div>
      </div>

      {percentage > 0 && (
        <div className="text-right flex-shrink-0 pl-2">
          <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950/40 border border-zinc-900/40 px-1.5 py-0.5 rounded-md">
            {Math.round(percentage)}%
          </span>
        </div>
      )}

      {/* Delicate Side Glow Strip indicating current focus */}
      {isActive && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 transition-all"
          style={{ backgroundColor: config.accentColor }}
        />
      )}
    </button>
  );
}
