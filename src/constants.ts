/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActivityMode, ActivityConfig } from './types';

export const ACTIVITY_CONFIGS: Record<ActivityMode, ActivityConfig> = {
  [ActivityMode.STUDYING]: {
    mode: ActivityMode.STUDYING,
    label: 'Studying',
    description: 'Learning, deep reading, coding, course work, or acquiring skills.',
    colorName: 'sky',
    bgClass: 'bg-sky-400/10 hover:bg-sky-400/15',
    textClass: 'text-sky-300',
    borderClass: 'border-sky-300/30',
    ringClass: 'ring-sky-350/20',
    glowClass: 'shadow-[0_0_20px_-3px_rgba(125,211,252,0.15)]',
    darkBgClass: 'bg-sky-950/45',
    accentColor: '#bae6fd',
  },
  [ActivityMode.NOT_STUDYING]: {
    mode: ActivityMode.NOT_STUDYING,
    label: 'Not Studying',
    description: 'Relaxing, breaks, sleeping, or other activities.',
    colorName: 'orange',
    bgClass: 'bg-orange-400/10 hover:bg-orange-400/15',
    textClass: 'text-orange-300',
    borderClass: 'border-orange-300/30',
    ringClass: 'ring-orange-350/20',
    glowClass: 'shadow-[0_0_20px_-3px_rgba(253,186,116,0.15)]',
    darkBgClass: 'bg-orange-950/30',
    accentColor: '#ffcc80',
  },
};
