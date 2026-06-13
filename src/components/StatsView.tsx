/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ActivityMode } from '../types';
import { ACTIVITY_CONFIGS } from '../constants';
import { Brain, Briefcase, Home, Dumbbell, Coffee, Award, Hourglass, Zap, Moon } from 'lucide-react';

interface StatsViewProps {
  totalTimes: Record<ActivityMode, number>;
}

export default function StatsView({ totalTimes }: StatsViewProps) {
  const [hoveredMode, setHoveredMode] = useState<ActivityMode | null>(null);

  // Calculate total session time in milliseconds
  const totalMs = Object.values(totalTimes).reduce((acc, curr) => acc + curr, 0);

  // Calculate percentages
  const percentages = Object.keys(ACTIVITY_CONFIGS).reduce((acc, key) => {
    const mode = key as ActivityMode;
    const ms = totalTimes[mode] || 0;
    acc[mode] = totalMs > 0 ? (ms / totalMs) * 100 : 0;
    return acc;
  }, {} as Record<ActivityMode, number>);

  // Compute Focus Score (Active vs passive)
  // Active: Studying
  // Passive: Not Studying
  const activeMs = totalTimes[ActivityMode.STUDYING] || 0;
  
  const focusScore = totalMs > 0 ? Math.round((activeMs / totalMs) * 100) : 0;

  // Render SVG Donut Configuration
  const radius = 70;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius; // ~439.82
  
  // Create segment list
  let accumulatedPercentage = 0;
  const segments = Object.keys(ACTIVITY_CONFIGS).map((key) => {
    const mode = key as ActivityMode;
    const pct = percentages[mode];
    const ms = totalTimes[mode];
    const config = ACTIVITY_CONFIGS[mode];
    
    const strokeDashoffset = circumference - (circumference * pct) / 100;
    const strokeDasharray = `${circumference} ${circumference}`;
    
    // Rotate the segment so they follow one after another
    const rotation = (accumulatedPercentage / 100) * 360 - 90;
    accumulatedPercentage += pct;

    return {
      mode,
      pct,
      ms,
      config,
      strokeDashoffset,
      strokeDasharray,
      rotation,
    };
  }).filter(s => s.pct > 0); // Only render segments with percentage

  const getFocusComment = (score: number) => {
    if (totalMs === 0) return 'Timer is warming up • Live breakdown will appear here';
    if (score >= 80) return 'Supercharged • Exceptional focus and balance!';
    if (score >= 60) return 'Highly Productive • Making great progress today!';
    if (score >= 40) return 'Steady Pace • A solid balance of work and rest.';
    if (score >= 20) return 'Mindful Recovery • Rest is good, keep taking easy steps.';
    return 'Winding Down • Deep relaxation mode. Take your time to recharge.';
  };

  const getFocusColor = (score: number) => {
    if (score >= 70) return 'text-violet-400 border-violet-500/20 bg-violet-500/5';
    if (score >= 40) return 'text-teal-400 border-teal-500/20 bg-teal-500/5';
    return 'text-zinc-400 border-zinc-500/20 bg-zinc-500/5';
  };

  const formatHrsMin = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const getIconForMode = (mode: ActivityMode, className: string) => {
    switch (mode) {
      case ActivityMode.STUDYING: return <Brain className={className} />;
      case ActivityMode.NOT_STUDYING: return <Coffee className={className} />;
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800/60 rounded-xl p-5 shadow-sm" id="analytics-section">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="text-zinc-500 h-3.5 w-3.5" /> Area Distribution
          </h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">Real-time statistics of cumulative tracked time</p>
        </div>
        
        {totalMs > 0 && (
          <div className="text-right">
            <span className="text-xs text-zinc-400 uppercase tracking-wider">Total Active</span>
            <div className="text-lg font-mono font-bold text-zinc-100">{formatHrsMin(totalMs)}</div>
          </div>
        )}
      </div>

      {totalMs === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-zinc-800 rounded-xl px-4">
          <Hourglass className="h-10 w-10 text-zinc-600 animate-pulse mb-3" />
          <p className="text-sm font-medium text-zinc-300">No time recorded yet</p>
          <p className="text-xs text-zinc-500 max-w-xs mt-1">
            Activate one of the activity timers above. The "constantly on" tracking ensures every single second is cataloged.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          
          {/* Circular Graph Column */}
          <div className="md:col-span-5 flex flex-col items-center justify-center">
            <div className="relative w-48 h-48">
              {/* Outer Glow */}
              <div className="absolute inset-0 rounded-full bg-zinc-950/40 border border-zinc-800" />
              
              <svg className="absolute inset-0 w-full h-full transform" viewBox="0 0 160 160" id="svg-donut">
                {/* Background Track Circle */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="#1e293b" // zinc-800
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                
                {/* Segments */}
                {segments.map((seg, idx) => {
                  const isHovered = hoveredMode === seg.mode;
                  return (
                    <motion.circle
                      key={seg.mode}
                      cx="80"
                      cy="80"
                      r={radius}
                      stroke={seg.config.accentColor}
                      strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                      fill="transparent"
                      strokeDasharray={seg.strokeDasharray}
                      strokeDashoffset={seg.strokeDashoffset}
                      transform={`rotate(${seg.rotation} 80 80)`}
                      strokeLinecap="round"
                      className="cursor-pointer transition-all duration-300 origin-center"
                      style={{ filter: isHovered ? `drop-shadow(0 0 6px ${seg.config.accentColor})` : 'none' }}
                      onMouseEnter={() => setHoveredMode(seg.mode)}
                      onMouseLeave={() => setHoveredMode(null)}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: idx * 0.05 }}
                    />
                  );
                })}
              </svg>

              {/* Central Text Panel */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 text-center">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest leading-none">
                  {hoveredMode ? ACTIVITY_CONFIGS[hoveredMode].label : 'Focus Score'}
                </span>
                <span className="text-3xl font-display font-bold text-white mt-1 select-none">
                  {hoveredMode 
                    ? `${Math.round(percentages[hoveredMode])}%` 
                    : `${focusScore}%`}
                </span>
                <span className="text-[10px] text-zinc-400 mt-1 font-mono">
                  {hoveredMode 
                    ? formatHrsMin(totalTimes[hoveredMode]) 
                    : `${formatHrsMin(activeMs)} / ${formatHrsMin(totalMs)}`}
                </span>
              </div>
            </div>
            
            {/* Focus Indicator Badge */}
            <div className={`mt-5 px-3 py-1.5 rounded-full border text-[11px] font-medium flex items-center gap-1.5 transition-all max-w-full truncate ${getFocusColor(focusScore)}`} id="focus-score-comment">
              <Award className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{getFocusComment(focusScore)}</span>
            </div>
          </div>

          {/* Progress List Column */}
          <div className="md:col-span-7 space-y-4">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Category Breakdown</h3>
            {Object.keys(ACTIVITY_CONFIGS).map((key) => {
              const mode = key as ActivityMode;
              const config = ACTIVITY_CONFIGS[mode];
              const pct = percentages[mode] || 0;
              const ms = totalTimes[mode] || 0;
              const isHovered = hoveredMode === mode;

              return (
                <div 
                  key={mode} 
                  className={`p-2.5 rounded-xl border border-transparent hover:border-zinc-800 hover:bg-zinc-950/30 transition-all duration-200 cursor-pointer ${isHovered ? 'bg-zinc-950/35 border-zinc-800' : ''}`}
                  onMouseEnter={() => setHoveredMode(mode)}
                  onMouseLeave={() => setHoveredMode(null)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${config.bgClass}`}>
                        {getIconForMode(mode, `h-3.5 w-3.5 ${config.textClass}`)}
                      </div>
                      <span className="text-xs font-semibold text-white">{config.label}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-mono font-bold text-zinc-300">{formatHrsMin(ms)}</span>
                      <span className="text-[10px] font-mono text-zinc-500">({Math.round(pct)}%)</span>
                    </div>
                  </div>
                  
                  {/* Progress Line */}
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full rounded-full"
                      style={{ backgroundColor: config.accentColor }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}
    </div>
  );
}
