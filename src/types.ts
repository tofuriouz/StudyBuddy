/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ActivityMode {
  STUDYING = 'STUDYING',
  NOT_STUDYING = 'NOT_STUDYING',
}

export interface CumulativeTime {
  STUDYING: number; // in milliseconds
  NOT_STUDYING: number;
}

export interface LogEntry {
  id: string;
  mode: ActivityMode;
  startTime: number; // timestamp
  endTime: number; // timestamp
  duration: number; // in milliseconds
}

export interface ActivityConfig {
  mode: ActivityMode;
  label: string;
  description: string;
  colorName: string; // e.g. 'emerald'
  bgClass: string;
  textClass: string;
  borderClass: string;
  ringClass: string;
  glowClass: string;
  darkBgClass: string;
  accentColor: string; // Hex for canvas or custom indicators
}
