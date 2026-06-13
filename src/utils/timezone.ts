/**
 * Timezone utilities to calibrate calculations specifically to Pacific Time (PST/PDT - America/Los_Angeles).
 * Ensures consistency across iframe sandblocks, containers, and client environments.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Gets the offset in milliseconds for the 'America/Los_Angeles' timezone at a given UTC epoch time.
 */
export function getPSTOffsetMs(date: Date): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    
    const pstParts = formatter.formatToParts(date);
    const map: Record<string, string> = {};
    pstParts.forEach(p => {
      map[p.type] = p.value;
    });
    
    let hr = parseInt(map.hour, 10);
    if (hr === 24) hr = 0; // standard formatting adjustment
    
    const pstLocalMs = Date.UTC(
      parseInt(map.year, 10),
      parseInt(map.month, 10) - 1,
      parseInt(map.day, 10),
      hr,
      parseInt(map.minute, 10),
      parseInt(map.second, 10)
    );
    
    return pstLocalMs - date.getTime();
  } catch (e) {
    // Standard PST offset fallback (UTC-8) if Intl.DateTimeFormat fails
    return -8 * 60 * 60 * 1000;
  }
}

/**
 * Returns the exact absolute start (00:00:00.000) and end (23:59:59.999) system UTC timestamps
 * for "today" in PST (America/Los_Angeles).
 */
export function getPSTDayBoundaries(absoluteMs: number) {
  const d = new Date(absoluteMs);
  const offset = getPSTOffsetMs(d);
  
  const pstLocalMs = absoluteMs + offset;
  const pstMidnightLocal = Math.floor(pstLocalMs / DAY_MS) * DAY_MS;
  
  const startMs = pstMidnightLocal - offset;
  const endMs = startMs + DAY_MS - 1;
  
  return { startMs, endMs };
}

export interface PSTDayRange {
  label: string; // e.g., "Mon" or "Today"
  formattedDate: string; // e.g., "Jun 12"
  startMs: number;
  endMs: number;
  isToday: boolean;
  dateKey: string; // "YYYY-MM-DD" style key
}

/**
 * Calculates correct calendar day boundary lists in Pacific Time (PST/PDT) for the last 7 days.
 */
export function getLast7PSTDays(nowMs: number): PSTDayRange[] {
  const days: PSTDayRange[] = [];
  const nowOffsetInPST = getPSTOffsetMs(new Date(nowMs));
  const nowLocalPST = nowMs + nowOffsetInPST;
  const todayMidnightLocalPST = Math.floor(nowLocalPST / DAY_MS) * DAY_MS;

  for (let i = 6; i >= 0; i--) {
    const targetMidnightLocalPST = todayMidnightLocalPST - (i * DAY_MS);
    
    // Recalculate exact offset for destination times to prevent DST transition jump errors
    const approxAbsolute = targetMidnightLocalPST - nowOffsetInPST;
    const preciseOffset = getPSTOffsetMs(new Date(approxAbsolute));
    
    const startMs = targetMidnightLocalPST - preciseOffset;
    const endMs = startMs + DAY_MS - 1;
    
    // Format using PDT/PST safe parts
    const dateInPST = new Date(startMs + 4 * 3600 * 1000); // 4 hours in represents the core of the day safely
    
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    const parts = formatter.formatToParts(dateInPST);
    const map: Record<string, string> = {};
    parts.forEach(p => {
      map[p.type] = p.value;
    });
    
    const isToday = i === 0;
    const label = isToday ? 'Today' : map.weekday;
    const formattedDate = `${map.month} ${map.day}`;
    
    // Standardized ISO key formatted to America/Los_Angeles
    const formatterISO = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const isoParts = formatterISO.formatToParts(dateInPST);
    const isoMap: Record<string, string> = {};
    isoParts.forEach(p => {
      isoMap[p.type] = p.value;
    });
    const dateKey = `${isoMap.year}-${isoMap.month}-${isoMap.day}`;

    days.push({
      label,
      formattedDate,
      startMs,
      endMs,
      isToday,
      dateKey
    });
  }
  
  return days;
}
