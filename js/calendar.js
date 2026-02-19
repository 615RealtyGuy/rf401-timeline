/* RF401 Contract Timeline — Calendar, ICS, and Google Calendar
   Ported from app/routers/api.py and app/routers/pages.py */

var Calendar = (function () {

    // -----------------------------------------------------------------------
    // ICS helpers
    // -----------------------------------------------------------------------

    function _icsEscape(text) {
        if (!text) return '';
        return text
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\n/g, '\\n');
    }

    function _formatICSDate(date) {
        var y = date.getFullYear();
        var m = String(date.getMonth() + 1).padStart(2, '0');
        var d = String(date.getDate()).padStart(2, '0');
        return y + m + d;
    }

    // -----------------------------------------------------------------------
    // ICS Export (port of api.py export_ics)
    // -----------------------------------------------------------------------

    function generateICS(deal) {
        var events = (deal.events || []).filter(function (e) {
            return e.event_date && e.event_type !== 'info';
        });

        var shortAddr = deal.property_address
            ? deal.property_address.split(',')[0].trim()
            : deal.name;

        var lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//SixOneFive//RF401 Contract Timeline//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:' + _icsEscape(deal.name) + ' - Timeline'
        ];

        events.forEach(function (event, idx) {
            var d = Materializer.parseDate(event.event_date);
            if (!d) return;

            var startStr = _formatICSDate(d);
            var endDate = new Date(d.getTime());
            endDate.setDate(endDate.getDate() + 1);
            var endStr = _formatICSDate(endDate);

            var uid = 'rf401-deal-' + deal.id + '-evt-' + idx + '@rf401.local';
            var typeLabel = event.event_type.toUpperCase();

            lines.push(
                'BEGIN:VEVENT',
                'UID:' + uid,
                'DTSTART;VALUE=DATE:' + startStr,
                'DTEND;VALUE=DATE:' + endStr,
                'SUMMARY:' + _icsEscape(shortAddr) + ' \u2014 [' + typeLabel + '] ' + _icsEscape(event.title),
                'DESCRIPTION:' + _icsEscape(deal.name) + ' - ' + _icsEscape(event.title),
                'END:VEVENT'
            );
        });

        lines.push('END:VCALENDAR');
        return lines.join('\r\n') + '\r\n';
    }

    function downloadICS(deal) {
        var content = generateICS(deal);
        var blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
        var url = URL.createObjectURL(blob);

        var link = document.createElement('a');
        link.href = url;
        var safeName = deal.name.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
        link.download = (safeName || 'deal') + '_timeline.ics';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // -----------------------------------------------------------------------
    // Google Calendar URL Builder
    // -----------------------------------------------------------------------

    function buildGCalURL(event, deal) {
        if (!event.event_date) return null;
        var d = Materializer.parseDate(event.event_date);
        if (!d) return null;

        var start = _formatICSDate(d);
        var endDate = new Date(d.getTime());
        endDate.setDate(endDate.getDate() + 1);
        var end = _formatICSDate(endDate);

        var shortAddr = deal.property_address
            ? deal.property_address.split(',')[0].trim()
            : deal.name;
        var title = shortAddr + ' \u2014 [' + event.event_type.toUpperCase() + '] ' + event.title;
        var details = deal.name + ' \u2014 ' + event.title;

        return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
            + '&text=' + encodeURIComponent(title)
            + '&dates=' + start + '/' + end
            + '&details=' + encodeURIComponent(details);
    }

    // -----------------------------------------------------------------------
    // Month Grid Generator (port of Python calendar.monthcalendar)
    // -----------------------------------------------------------------------

    function monthCalendar(year, month) {
        // month is 1-based (January = 1)
        var firstDay = new Date(year, month - 1, 1);
        var daysInMonth = new Date(year, month, 0).getDate();
        // Convert to Monday=0 start
        var startDow = (firstDay.getDay() + 6) % 7;

        var weeks = [];
        var currentWeek = [0, 0, 0, 0, 0, 0, 0];

        for (var day = 1; day <= daysInMonth; day++) {
            var dow = (startDow + day - 1) % 7;
            if (dow === 0 && day > 1) {
                weeks.push(currentWeek);
                currentWeek = [0, 0, 0, 0, 0, 0, 0];
            }
            currentWeek[dow] = day;
        }
        weeks.push(currentWeek);

        return weeks;
    }

    function getMonthName(month) {
        var names = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
        return names[month - 1] || '';
    }

    function buildEventsByDay(events, year, month) {
        var byDay = {};
        (events || []).forEach(function (evt) {
            if (!evt.event_date || evt.event_type === 'info') return;
            var d = Materializer.parseDate(evt.event_date);
            if (!d) return;
            if (d.getFullYear() === year && d.getMonth() === month - 1) {
                var day = d.getDate();
                if (!byDay[day]) byDay[day] = [];
                byDay[day].push(evt);
            }
        });
        return byDay;
    }

    // -----------------------------------------------------------------------
    // Add All to Google Calendar
    // -----------------------------------------------------------------------

    function addAllToGCal(deal) {
        var urls = [];
        var seen = {};
        (deal.events || []).forEach(function (evt) {
            var url = buildGCalURL(evt, deal);
            if (url && !seen[url]) {
                seen[url] = true;
                urls.push(url);
            }
        });

        if (urls.length === 0) {
            showToast('No dated events to add.', 'warning');
            return;
        }

        var i = 0;
        function openNext() {
            if (i < urls.length) {
                window.open(urls[i], '_blank');
                i++;
                setTimeout(openNext, 600);
            } else {
                showToast('Opened ' + urls.length + ' event(s) in Google Calendar.', 'success');
            }
        }
        openNext();
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    return {
        generateICS: generateICS,
        downloadICS: downloadICS,
        buildGCalURL: buildGCalURL,
        monthCalendar: monthCalendar,
        getMonthName: getMonthName,
        buildEventsByDay: buildEventsByDay,
        addAllToGCal: addAllToGCal
    };
})();
