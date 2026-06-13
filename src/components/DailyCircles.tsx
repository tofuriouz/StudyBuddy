/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ActivityMode, LogEntry } from '../types';
import { ACTIVITY_CONFIGS } from '../constants';
import { CalendarRange, Info } from 'lucide-react';
import { getLast7PSTDays } from '../utils/timezone';

interface DailyCirclesProps {
  logs: LogEntry[];
  activeMode: ActivityMode;
  lastStateChange: number;
}

interface DayData {
  date: Date;
  label: string; // e.g. "Mon"
  formattedDate: string; // e.g. "Jun 12"
  times: Record<ActivityMode, number>;
  totalTime: number;
  arcs: {
    id: string;
    config: any;
    strokeDashoffset: number;
    rotation: number;
    pct: number;
  }[];
}

export default function DailyCircles({ logs, activeMode, lastStateChange }: DailyCirclesProps) {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(6); // Default to today (last of the 7)

  const DAY_MS = 24 * 60 * 60 * 1000;
  const radius = 21;
  const circumference = 2 * Math.PI * radius; // ~131.9

  // Generate and aggregate time for each day calibrated in PST/PDT timezone boundaries
  const pstDays = getLast7PSTDays(Date.now());

  const dailyData: DayData[] = pstDays.map((range) => {
    const times: Record<ActivityMode, number> = {
      [ActivityMode.STUDYING]: 0,
      [ActivityMode.NOT_STUDYING]: 0,
    };

    const arcs: any[] = [];

    // Filter logs strictly falling within the PST day start/end boundaries, create chronological arcs
    logs.forEach((log) => {
      const logEndTime = log.startTime + log.duration;
      // Skip completely out of bounds
      if (log.startTime > range.endMs || logEndTime < range.startMs) return;

      // Clamp exactly to day boundaries
      const activeStart = Math.max(log.startTime, range.startMs);
      const activeEnd = Math.min(logEndTime, range.endMs);
      const durationMs = activeEnd - activeStart;

      if (durationMs > 0) {
        // Safe check for valid log mode
        const logMode = (log.mode && ACTIVITY_CONFIGS[log.mode]) ? log.mode : ActivityMode.NOT_STUDYING;
        times[logMode] += durationMs;

        const pct = durationMs / DAY_MS;
        const startPct = (activeStart - range.startMs) / DAY_MS;
        arcs.push({
          id: log.id,
          config: ACTIVITY_CONFIGS[logMode],
          strokeDashoffset: circumference - (circumference * pct),
          rotation: (startPct * 360) - 90,
          pct,
        });
      }
    });

    if (range.isToday) {
      const liveStart = Math.max(lastStateChange, range.startMs);
      const liveEnd = Math.min(Date.now(), range.endMs);
      const liveDuration = liveEnd - liveStart;
      if (liveDuration > 0) {
        const safeActiveMode = (activeMode && ACTIVITY_CONFIGS[activeMode]) ? activeMode : ActivityMode.NOT_STUDYING;
        times[safeActiveMode] += liveDuration;

        const pct = liveDuration / DAY_MS;
        const startPct = (liveStart - range.startMs) / DAY_MS;
        arcs.push({
          id: 'live',
          config: ACTIVITY_CONFIGS[safeActiveMode],
          strokeDashoffset: circumference - (circumference * pct),
          rotation: (startPct * 360) - 90,
          pct,
        });
      }
    }

    const totalTime = Object.values(times).reduce((a, b) => a + b, 0);

    return {
      date: new Date(range.startMs + 4 * 3600 * 1000), // Mid-day representation safely
      label: range.label,
      formattedDate: range.formattedDate,
      times,
      totalTime,
      arcs,
    };
  });

  const selectedDay = selectedDayIndex !== null ? dailyData[selectedDayIndex] : null;

  const formatHrsMin = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${totalSecs % 60}s`;
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800/60 rounded-xl p-5 space-y-4" id="daily-circles-habits">
      
      {/* Mini Title block */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <CalendarRange className="text-zinc-500 h-3.5 w-3.5" /> 7-Day Activity Circles
        </h3>
        {selectedDay && (
          <span className="text-[11px] font-mono font-medium text-zinc-500">
            Selected: {selectedDay.formattedDate} ({selectedDay.label})
          </span>
        )}
      </div>

      {/* 7 Circles Horizontal Ring list */}
      <div className="grid grid-cols-7 gap-2 bg-black p-3 rounded-lg border border-zinc-800/40" id="circles-grid-row">
        {dailyData.map((day, idx) => {
          const isSelected = selectedDayIndex === idx;
          const hasTime = day.totalTime > 0;
          
          const radius = 21;
          const strokeWidth = 2.5; // Highly precise elegant line
          const circumference = 2 * Math.PI * radius; // ~131.9
          
          return (
            <div 
              key={idx}
              onClick={() => setSelectedDayIndex(idx)}
              className={`flex flex-col items-center p-1.5 rounded-lg cursor-pointer transition-all relative ${
                isSelected 
                  ? 'bg-zinc-900 border border-zinc-800 shadow-sm' 
                  : 'hover:bg-zinc-900/30'
              }`}
            >
              {/* SVG Minimalist high-contrast circle */}
              <div className="relative w-11 h-11" id={`circle-chart-${idx}`}>
                <svg className="w-full h-full transform" viewBox="0 0 48 48">
                  {/* Subtle grey track backing */}
                  <circle
                    cx="24"
                    cy="24"
                    r={radius}
                    stroke={isSelected ? '#334155' : '#1e293b'}
                    strokeWidth={1}
                    fill="transparent"
                  />
                  
                  {/* Dash patterns if completely empty day */}
                  {!hasTime && (
                    <circle
                      cx="24"
                      cy="24"
                      r={radius}
                      stroke="#334155"
                      strokeWidth={1.2}
                      strokeDasharray="3 3"
                      fill="transparent"
                      className="opacity-25"
                    />
                  )}

                  {hasTime && day.arcs.map((arc, aIdx) => (
                    <circle
                      key={aIdx}
                      cx="24"
                      cy="24"
                      r={radius}
                      stroke={arc.config.accentColor}
                      strokeWidth={strokeWidth}
                      fill="transparent"
                      strokeDasharray={`${circumference} ${circumference}`}
                      strokeDashoffset={arc.strokeDashoffset}
                      transform={`rotate(${arc.rotation} 24 24)`}
                    />
                  ))}
                </svg>

                {/* Central minimalist static point */}
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className={`w-1 h-1 rounded-full ${hasTime ? 'bg-zinc-300' : 'bg-zinc-700/50'}`} />
                </span>
              </div>

              {/* Minimal Text labels */}
              <span className="text-[10px] font-bold text-zinc-300 mt-1.5">
                {day.label === 'Today' ? 'Today' : day.label.charAt(0)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Selected Day Quiet Summary Panel */}
      <AnimatePresence mode="wait">
        {selectedDay && (
          <motion.div 
            key={selectedDayIndex}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="bg-black border border-zinc-900 rounded-lg p-3.5 space-y-2.5"
            id="expanded-day-view"
          >
            <div className="flex items-center justify-between text-xs border-b border-zinc-800/60 pb-1.5">
              <span className="font-semibold text-zinc-400">
                Logged Breakdown
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                Total Tracked: <strong className="text-white">{selectedDay.totalTime > 0 ? formatHrsMin(selectedDay.totalTime) : '0m'}</strong>
              </span>
            </div>

            {selectedDay.totalTime === 0 ? (
              <p className="text-[11px] text-zinc-500 flex items-center gap-1.5 py-1">
                <Info className="h-3.5 w-3.5" /> No activity logs captured for this date.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(ACTIVITY_CONFIGS).map((key) => {
                  const mode = key as ActivityMode;
                  const ms = selectedDay.times[mode] || 0;
                  const config = ACTIVITY_CONFIGS[mode];
                  const pct = selectedDay.totalTime > 0 ? (ms / selectedDay.totalTime) * 100 : 0;

                  return (
                    <div 
                      key={mode} 
                      className="px-3 py-2 bg-zinc-900/40 border border-zinc-800/50 rounded-lg flex items-center justify-between"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: config.accentColor }} />
                        <span className="text-[11px] font-medium text-zinc-300">{config.label}</span>
                      </div>
                      <div className="flex items-baseline gap-1 font-mono text-[11px]">
                        <span className={ms > 0 ? "font-semibold text-zinc-100" : "text-zinc-500"}>{ms > 0 ? formatHrsMin(ms) : '0s'}</span>
                        <span className="text-[9px] text-zinc-500">({Math.round(pct)}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
