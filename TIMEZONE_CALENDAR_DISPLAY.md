# Calendar Timezone Display Implementation

## Overview
This document explains how booking times should be displayed in the admin calendar when bookings span multiple Australian timezones.

## Decision: Display Event Local Time (Option A)

**Selected Approach:** Display all booking times in their **event's local timezone** with clear timezone indicators.

**Example:**
- Melbourne booking at 5:00pm AEDT (Melbourne time)
- Brisbane booking at 5:00pm AEST (Brisbane time)

## Rationale

### Why Event Local Time?

1. **Operational Clarity**
   - Therapist sees "5pm" on their phone → Admin sees "5pm" → No confusion
   - Customer booked "5pm Melbourne" → Admin sees "5pm Melbourne"
   - Simple mental model: "The Melbourne booking is at 5pm"

2. **Consistency Across Users**
   - Therapist, customer, and admin all see the same time
   - Reduces communication errors
   - Matches booking confirmation emails

3. **Natural Scheduling**
   - "9am-5pm business hours" means different UTC times in different zones
   - Displaying local time makes regional patterns immediately visible
   - Easier to spot scheduling conflicts within a region

## Implementation Details

### Database Fields

**bookings table:**
- `booking_time` - timestamptz (stores absolute moment in time)
- `booking_timezone` - text (e.g., 'Australia/Melbourne')

**therapist_profiles table:**
- `timezone` - text (therapist's service area timezone)

**quotes table:**
- `event_timezone` - text (corporate event location timezone)

### Display Format

**Calendar View:**
```
┌─────────────────────────────────┐
│ 4:00pm │ Brisbane Booking (QLD) │
├─────────────────────────────────┤
│ 5:00pm │ Melbourne Booking (VIC)│  ← Actually 4pm Brisbane time
├─────────────────────────────────┤
│ 6:00pm │ Sydney Booking (NSW)   │  ← Actually 5pm Brisbane time
└─────────────────────────────────┘
```

**Timezone Badge Examples:**
- `5:00pm AEDT` (shows DST status)
- `5:00pm (VIC)` (shows state)
- `5:00pm 🕐` with tooltip showing timezone

### Code Implementation

**Converting for Display:**
```javascript
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

function formatBookingTime(booking) {
  // booking.booking_time is timestamptz from database
  // booking.booking_timezone is 'Australia/Melbourne'

  const localTime = dayjs(booking.booking_time)
    .tz(booking.booking_timezone)
    .format('h:mm a');

  const tzAbbr = getTzAbbreviation(booking.booking_timezone);

  return `${localTime} ${tzAbbr}`;
  // Returns: "5:00pm AEDT"
}

function getTzAbbreviation(timezone) {
  // This should check if DST is active for the booking date
  const tzMap = {
    'Australia/Perth': 'AWST',
    'Australia/Adelaide': 'ACST/ACDT', // Varies with season
    'Australia/Darwin': 'ACST',
    'Australia/Brisbane': 'AEST',
    'Australia/Sydney': 'AEST/AEDT', // Varies with season
    'Australia/Melbourne': 'AEST/AEDT',
    'Australia/Hobart': 'AEST/AEDT'
  };
  return tzMap[timezone] || '';
}
```

### Calendar Component Updates

**Admin Calendar (`admin/src/pages/bookings/calendar.tsx`):**

1. **Parse booking time in event timezone:**
```javascript
const displayTime = dayjs(booking.booking_time)
  .tz(booking.booking_timezone);
```

2. **Add timezone badge to event:**
```javascript
<div className="event-time">
  {displayTime.format('h:mm a')}
  <span className="tz-badge">{getTzAbbreviation(booking.booking_timezone)}</span>
</div>
```

3. **Optional: Add toggle for "Show in my timezone":**
```javascript
const [viewTimezone, setViewTimezone] = useState('local'); // 'local' or 'Brisbane'

// When viewTimezone === 'Brisbane':
const displayTime = dayjs(booking.booking_time)
  .tz('Australia/Brisbane');
```

## User Experience

### For Admin Users

**Default View (Event Local Time):**
- ✅ See booking times as they were booked
- ✅ Match therapist and customer expectations
- ✅ Timezone badge shows which timezone (e.g., "VIC", "AEDT")

**Optional Toggle (Admin's Local Time):**
- Convert all times to admin's timezone (e.g., Brisbane)
- Useful for: "What's happening in the next hour MY time?"
- Shows relative timing across regions

### Timezone Indicators

**Visual Options:**

1. **Text Badge:**
   ```
   5:00pm AEDT
   ```

2. **State Badge:**
   ```
   5:00pm (VIC)
   ```

3. **Color Coding:**
   - Blue: QLD (Brisbane)
   - Green: VIC/NSW (Melbourne/Sydney)
   - Orange: WA (Perth)
   - Purple: SA (Adelaide)

4. **Icon + Tooltip:**
   ```
   5:00pm 🕐
   └─ Hover: "Melbourne time (AEDT, UTC+11)"
   ```

## Benefits

✅ **No Confusion** - Everyone sees the time they expect
✅ **Accurate Communication** - "Your 5pm booking" means 5pm local
✅ **Regional Patterns Visible** - Easy to see Brisbane vs Melbourne schedules
✅ **Therapist Alignment** - Admin sees what therapist sees
✅ **Simple Mental Model** - No UTC conversion required for day-to-day use

## Alternative: Admin's Local Time (Option B - Not Recommended)

**How it would work:**
- Melbourne 5pm AEDT → Brisbane 4pm AEST
- All times converted to admin's timezone

**Why we didn't choose this:**
- ❌ Therapist sees "5pm", admin sees "4pm" - confusing
- ❌ Customer expects "5pm", admin scheduling shows "4pm"
- ❌ Harder to spot regional scheduling patterns
- ❌ Requires mental conversion: "Which time is 'real'?"

**When to use:**
- As an optional toggle for "Show all in my timezone"
- Useful for coordinating across regions
- But not the default view

## Testing Scenarios

### Scenario 1: Same Timezone
- **Booking:** Brisbane at 5pm AEST
- **Admin Location:** Brisbane
- **Display:** 5:00pm AEST ✓

### Scenario 2: Different Timezone (DST)
- **Booking:** Melbourne at 5pm AEDT (UTC+11)
- **Admin Location:** Brisbane (UTC+10)
- **Display:** 5:00pm AEDT (shows Melbourne time)
- **Actual Brisbane time:** 4:00pm AEST

### Scenario 3: No DST Zone
- **Booking:** Brisbane at 5pm AEST (no DST)
- **Display:** 5:00pm AEST
- **Note:** Brisbane time never changes (no daylight saving)

### Scenario 4: Western Australia
- **Booking:** Perth at 5pm AWST (UTC+8)
- **Admin Location:** Brisbane (UTC+10)
- **Display:** 5:00pm AWST
- **Actual Brisbane time:** 7:00pm AEST

## Implementation Checklist

- [ ] Update calendar component to use booking.booking_timezone
- [ ] Add dayjs timezone plugins
- [ ] Create timezone abbreviation helper function
- [ ] Add timezone badge/indicator to calendar events
- [ ] Test display across all Australian timezones
- [ ] Optional: Add "Show in my timezone" toggle
- [ ] Update booking list views with same logic
- [ ] Update therapist schedule views

## Future Enhancements

1. **Smart Defaults:**
   - Auto-detect admin's timezone from browser
   - Remember admin's timezone preference

2. **Multi-Region View:**
   - Side-by-side calendars for different regions
   - Useful for coordinating interstate bookings

3. **Timezone Warnings:**
   - Alert when booking crosses timezone boundaries
   - Highlight potential confusion scenarios

4. **Recurring Bookings:**
   - Handle DST transitions (booking at "5pm local" stays "5pm local" even when clocks change)
   - Important for weekly/monthly recurring bookings

---

**Last Updated:** 2025-11-26
**Status:** Implementation Pending
**Related Files:**
- `admin/src/pages/bookings/calendar.tsx`
- `admin/src/pages/bookings/list.tsx`
- `database-timezone-fixes.sql`
