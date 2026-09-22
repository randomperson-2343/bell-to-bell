// Trading calendar + clock formatting. Day 0 is a Monday, Oct 1; weekends skipped.
(function (B) {
  'use strict';
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const DOWL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  B.Calendar = {
    storyLabel(d) {
      return `Week ${Math.floor(d / 5) + 1} · ${DOWL[d % 5]}`;
    },
    dayInfo(d) {
      const week = Math.floor(d / 5), dow = d % 5;
      return {
        dow,
        short: `W${week + 1} ${DOW[dow]}`,
        label: `Week ${week + 1} · ${DOW[dow]}`,
        long: `Week ${week + 1} · ${DOWL[dow]}`
      };
    },
    fmtTime(t, withSec) {
      const totalSec = Math.floor((570 + t) * 60);
      const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
      const ap = h >= 12 ? 'PM' : 'AM';
      const h12 = ((h + 11) % 12) + 1;
      return `${h12}:${String(m).padStart(2, '0')}${withSec ? ':' + String(s).padStart(2, '0') : ''} ${ap}`;
    }
  };
})(window.BTB);
