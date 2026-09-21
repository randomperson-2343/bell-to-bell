// Trading calendar + clock formatting. Day 0 is a Monday, Oct 1; weekends skipped.
(function (B) {
  'use strict';
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const DOWL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  B.Calendar = {
    dayInfo(d) {
      const week = Math.floor(d / 5), dow = d % 5;
      // 2029 is used only for its weekday layout. The fiction intentionally omits a year.
      const date = new Date(2029, 9, 1 + week * 7 + dow);
      const m = date.getMonth(), dd = date.getDate();
      return {
        dow,
        short: `${MON[m]} ${dd}`,
        label: `${DOW[dow]}, ${MON[m]} ${dd}`,
        long: `${DOWL[dow]}, ${MONL[m]} ${dd}`
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
