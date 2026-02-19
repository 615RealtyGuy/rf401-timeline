/* ============================================================
   pdf-export.js  –  Deal Card PDF generator (jsPDF)
   RF401 Contract Timeline  ·  SixOneFive
   ============================================================ */
var PdfExport = (function () {
    'use strict';

    /* ---- constants ---- */
    var PAGE_W  = 612;          // US Letter width  (pt)
    var PAGE_H  = 792;          // US Letter height (pt)
    var MARGIN  = 36;           // 0.5 in
    var CW      = PAGE_W - 2 * MARGIN;  // content width 540

    // Colors (RGB)
    var GOLD       = [210, 181, 108];
    var DARK_BG    = [28, 28, 33];
    var WHITE      = [255, 255, 255];
    var LIGHT_GRAY = [180, 180, 185];
    var BODY       = [35, 35, 40];
    var LABEL_GRAY = [120, 120, 125];
    var ROW_ALT    = [245, 245, 248];
    var ROW_HEADER = [250, 246, 235];
    var RED        = [220, 70, 70];
    var GREEN      = [52, 180, 120];
    var DIVIDER    = [210, 210, 215];

    /* ---- helpers ---- */
    function _trunc(s, max) {
        if (!s) return '';
        return s.length > max ? s.substring(0, max - 1) + '\u2026' : s;
    }

    function _fmtDate(d) {
        if (!d) return 'TBD';
        return Materializer.formatDateDisplay(d);
    }

    function _fmtCreated(iso) {
        if (!iso) return '---';
        var d = new Date(iso);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function _cap(s) {
        if (!s) return '';
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    /* check page break, return (possibly reset) y */
    function _pb(doc, y, need) {
        if (y + need > PAGE_H - MARGIN - 20) {
            doc.addPage();
            return MARGIN;
        }
        return y;
    }

    /* set fill color from array */
    function _fc(doc, c) { doc.setFillColor(c[0], c[1], c[2]); }
    function _tc(doc, c) { doc.setTextColor(c[0], c[1], c[2]); }
    function _dc(doc, c) { doc.setDrawColor(c[0], c[1], c[2]); }

    /* ============================================================
       SECTION A  –  Header Band
       ============================================================ */
    function _drawHeader(doc, deal) {
        var bandH = 90;

        // Dark background band (full width, no margins)
        _fc(doc, DARK_BG);
        doc.rect(0, 0, PAGE_W, bandH, 'F');

        // "DEAL CARD" label
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        _tc(doc, GOLD);
        doc.text('DEAL CARD', MARGIN, 22);

        // Branding right
        doc.setFontSize(7);
        doc.text('SixOneFive  |  RF401 Timeline', PAGE_W - MARGIN, 22, { align: 'right' });

        // Deal name
        doc.setFontSize(16);
        _tc(doc, WHITE);
        var name = _trunc(deal.name || 'Untitled Deal', 60);
        doc.text(name, MARGIN, 42);

        // Property address
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        _tc(doc, LIGHT_GRAY);
        doc.text(_trunc(deal.property_address || '', 80), MARGIN, 58);

        // Status pill
        var status = (deal.status || 'active').toUpperCase();
        var pillColor = status === 'ARCHIVED' ? LABEL_GRAY : GREEN;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        var pillW = doc.getTextWidth(status) + 12;
        var pillX = PAGE_W - MARGIN - pillW;
        var pillY = 35;
        _fc(doc, pillColor);
        doc.roundedRect(pillX, pillY, pillW, 14, 3, 3, 'F');
        _tc(doc, WHITE);
        doc.text(status, pillX + pillW / 2, pillY + 10, { align: 'center' });

        // Gold accent line
        doc.setLineWidth(1.5);
        _dc(doc, GOLD);
        doc.line(0, bandH, PAGE_W, bandH);

        return bandH + 14;
    }

    /* ============================================================
       SECTION B  –  Key Info Row
       ============================================================ */
    function _drawKeyInfo(doc, deal, y) {
        var cols = [
            { label: 'BUYER',  value: deal.buyer_name  || '---' },
            { label: 'SELLER', value: deal.seller_name || '---' },
            { label: 'BINDING AGREEMENT DATE', value: _fmtDate(deal.binding_agreement_date) },
            { label: 'STATUS', value: _cap(deal.status || 'active') },
            { label: 'CREATED', value: _fmtCreated(deal.created_at) }
        ];

        // 3 items first row, 2 items second row
        var colW = CW / 3;
        var rowH = 28;

        for (var i = 0; i < cols.length; i++) {
            var col = i < 3 ? i : i - 3;
            var row = i < 3 ? 0 : 1;
            var x = MARGIN + col * colW;
            var cy = y + row * rowH;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            _tc(doc, LABEL_GRAY);
            doc.text(cols[i].label, x, cy);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            _tc(doc, BODY);
            doc.text(_trunc(cols[i].value, 35), x, cy + 11);
        }

        var totalH = cols.length > 3 ? rowH * 2 : rowH;
        y += totalH + 6;

        // Divider
        doc.setLineWidth(0.5);
        _dc(doc, DIVIDER);
        doc.line(MARGIN, y, PAGE_W - MARGIN, y);

        return y + 10;
    }

    /* ============================================================
       Section title helper
       ============================================================ */
    function _sectionTitle(doc, title, y) {
        y = _pb(doc, y, 30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        _tc(doc, GOLD);
        doc.text(title, MARGIN, y);
        doc.setLineWidth(0.75);
        _dc(doc, GOLD);
        doc.line(MARGIN, y + 3, MARGIN + doc.getTextWidth(title), y + 3);
        return y + 16;
    }

    /* ============================================================
       SECTION C  –  Timeline Events Table
       ============================================================ */
    function _drawTimeline(doc, deal, y) {
        y = _sectionTitle(doc, 'TIMELINE EVENTS', y);

        var events = (deal.events || []).filter(function (e) { return e.event_type !== 'info'; });
        events.sort(function (a, b) {
            if (!a.event_date && !b.event_date) return 0;
            if (!a.event_date) return 1;
            if (!b.event_date) return -1;
            return a.event_date.localeCompare(b.event_date);
        });

        if (events.length === 0) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            _tc(doc, LABEL_GRAY);
            doc.text('No timeline events generated yet.', MARGIN, y);
            return y + 16;
        }

        // Column widths
        var dateW = 85;
        var typeW = 65;
        var eventW = CW - dateW - typeW;
        var rowH = 16;

        // Table header
        y = _pb(doc, y, rowH + 4);
        _fc(doc, ROW_HEADER);
        doc.rect(MARGIN, y - 10, CW, rowH, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        _tc(doc, BODY);
        doc.text('DATE', MARGIN + 4, y - 1);
        doc.text('EVENT', MARGIN + dateW + 4, y - 1);
        doc.text('TYPE', MARGIN + dateW + eventW + 4, y - 1);
        y += rowH - 4;

        // Rows
        for (var i = 0; i < events.length; i++) {
            var ev = events[i];

            // Wrap title if needed
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            var titleLines = doc.splitTextToSize(_trunc(ev.title || '', 70), eventW - 8);
            var thisRowH = Math.max(rowH, titleLines.length * 10 + 6);

            y = _pb(doc, y, thisRowH);

            // Alternating row background
            if (i % 2 === 1) {
                _fc(doc, ROW_ALT);
                doc.rect(MARGIN, y - 10, CW, thisRowH, 'F');
            }

            // Date
            var dateStr = ev.event_date ? _fmtDate(ev.event_date) : 'TBD';
            if (!ev.event_date) {
                doc.setFont('helvetica', 'italic');
                _tc(doc, LABEL_GRAY);
            } else {
                doc.setFont('helvetica', 'normal');
                _tc(doc, BODY);
            }
            doc.setFontSize(8);
            doc.text(dateStr, MARGIN + 4, y);

            // Title
            doc.setFont('helvetica', 'normal');
            _tc(doc, BODY);
            for (var li = 0; li < titleLines.length; li++) {
                doc.text(titleLines[li], MARGIN + dateW + 4, y + li * 10);
            }

            // Type badge
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            var typeLabel = (ev.event_type || '').toUpperCase();
            if (ev.event_type === 'milestone') {
                _tc(doc, GOLD);
            } else {
                _tc(doc, RED);
            }
            doc.text(typeLabel, MARGIN + dateW + eventW + 4, y);

            y += thisRowH - 4;
        }

        // Bottom border
        doc.setLineWidth(0.5);
        _dc(doc, DIVIDER);
        doc.line(MARGIN, y + 2, PAGE_W - MARGIN, y + 2);

        return y + 14;
    }

    /* ============================================================
       SECTION D  –  Tasks Checklist
       ============================================================ */
    function _drawTasks(doc, deal, y) {
        y = _sectionTitle(doc, 'TASKS', y);

        var tasks = deal.tasks || [];
        if (tasks.length === 0) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            _tc(doc, LABEL_GRAY);
            doc.text('No tasks generated yet.', MARGIN, y);
            return y + 16;
        }

        // Group by category
        var catOrder = ['inspection', 'financing', 'closing', 'repair', 'other'];
        var catLabels = {
            inspection: 'Inspection',
            financing:  'Financing',
            closing:    'Closing',
            repair:     'Repair',
            other:      'Other'
        };
        var groups = {};
        for (var t = 0; t < tasks.length; t++) {
            var cat = tasks[t].category || 'other';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(tasks[t]);
        }

        for (var ci = 0; ci < catOrder.length; ci++) {
            var catKey = catOrder[ci];
            var catTasks = groups[catKey];
            if (!catTasks || catTasks.length === 0) continue;

            y = _pb(doc, y, 24);

            // Category header
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            _tc(doc, GOLD);
            doc.text(catLabels[catKey] + ' (' + catTasks.length + ')', MARGIN, y);
            y += 12;

            for (var ti = 0; ti < catTasks.length; ti++) {
                var task = catTasks[ti];
                y = _pb(doc, y, 14);

                // Checkbox
                var boxX = MARGIN;
                var boxY = y - 7;
                var boxS = 8;
                doc.setLineWidth(0.5);
                _dc(doc, LABEL_GRAY);
                doc.rect(boxX, boxY, boxS, boxS);

                if (task.status === 'done') {
                    // Checkmark
                    doc.setLineWidth(1.2);
                    _dc(doc, GREEN);
                    doc.line(boxX + 1.5, boxY + 4, boxX + 3.5, boxY + 6.5);
                    doc.line(boxX + 3.5, boxY + 6.5, boxX + 7, boxY + 1.5);
                } else if (task.status === 'doing') {
                    // Diagonal slash
                    doc.setLineWidth(1);
                    _dc(doc, GOLD);
                    doc.line(boxX + 2, boxY + 6, boxX + 6, boxY + 2);
                }

                // Task title
                var titleX = MARGIN + 14;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                _tc(doc, BODY);
                var taskTitle = _trunc(task.title || '', 60);
                doc.text(taskTitle, titleX, y);

                // Strikethrough for done
                if (task.status === 'done') {
                    var tw = doc.getTextWidth(taskTitle);
                    doc.setLineWidth(0.5);
                    _dc(doc, LABEL_GRAY);
                    doc.line(titleX, y - 2.5, titleX + tw, y - 2.5);
                }

                // Due date right-aligned
                if (task.due_date) {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7);
                    _tc(doc, LABEL_GRAY);
                    doc.text(_fmtDate(task.due_date), PAGE_W - MARGIN, y, { align: 'right' });
                }

                y += 14;
            }

            y += 4;
        }

        return y + 4;
    }

    /* ============================================================
       SECTION E  –  Contract Terms & Financial Info
       ============================================================ */
    function _drawDealInfo(doc, deal, y) {
        var items = deal.info_items || [];
        if (items.length === 0) return y;

        y = _sectionTitle(doc, 'CONTRACT TERMS & FINANCIAL INFO', y);

        var halfW = (CW - 20) / 2;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var val = item.value || '---';
            var isLong = val.length > 45;

            y = _pb(doc, y, 28);

            // Label
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            _tc(doc, LABEL_GRAY);

            var labelText = (item.label || '').toUpperCase();
            if (item.section) labelText += '  \u00B7  ' + item.section;

            if (isLong || i % 2 === 0) {
                // Full width or left column
                var colX = MARGIN;
                doc.text(labelText, colX, y);

                // Value
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8.5);
                _tc(doc, BODY);
                var valW = isLong ? CW : halfW;
                var lines = doc.splitTextToSize(val, valW);
                for (var li = 0; li < lines.length; li++) {
                    doc.text(lines[li], colX, y + 11 + li * 10);
                }
                y += 14 + lines.length * 10;

                // If long, skip the partner column
                if (isLong && i + 1 < items.length) continue;
            }

            // Right column (only for even-index short items followed by another item)
            if (!isLong && i % 2 === 0 && i + 1 < items.length) {
                var nextItem = items[i + 1];
                var nextVal = nextItem.value || '---';
                var nextLong = nextVal.length > 45;

                if (!nextLong) {
                    var rx = MARGIN + halfW + 20;
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(6.5);
                    _tc(doc, LABEL_GRAY);
                    var nextLabel = (nextItem.label || '').toUpperCase();
                    if (nextItem.section) nextLabel += '  \u00B7  ' + nextItem.section;
                    doc.text(nextLabel, rx, y - 14 + 11 - 11); // align with left label

                    // Recompute: draw at same y as left side
                    // Actually we need to re-align. Let me use a fixed offset from the label y.
                    var labelY = y - 14 - (1) * 10; // back to where left label was
                    doc.text(nextLabel, rx, labelY + 10 - 10);

                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8.5);
                    _tc(doc, BODY);
                    var rLines = doc.splitTextToSize(nextVal, halfW);
                    for (var rli = 0; rli < rLines.length; rli++) {
                        doc.text(rLines[rli], rx, labelY + 10 - 10 + 11 + rli * 10);
                    }
                    i++; // skip next since we drew it
                }
            }
        }

        return y + 4;
    }

    /* ============================================================
       SECTION F  –  Footer (drawn on every page)
       ============================================================ */
    function _drawFooter(doc) {
        var pages = doc.getNumberOfPages();
        var today = new Date().toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });

        for (var p = 1; p <= pages; p++) {
            doc.setPage(p);

            var fy = PAGE_H - 24;

            // Divider line
            doc.setLineWidth(0.3);
            _dc(doc, DIVIDER);
            doc.line(MARGIN, fy, PAGE_W - MARGIN, fy);

            fy += 10;

            // Left: generated date
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            _tc(doc, LABEL_GRAY);
            doc.text('Generated ' + today + '  \u00B7  RF401 Timeline', MARGIN, fy);

            // Right: disclaimer
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(5.5);
            doc.text('Not legal advice. Verify dates against signed contract.', PAGE_W - MARGIN, fy, { align: 'right' });

            // Page number (center)
            if (pages > 1) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6);
                _tc(doc, LABEL_GRAY);
                doc.text('Page ' + p + ' of ' + pages, PAGE_W / 2, fy, { align: 'center' });
            }
        }
    }

    /* ============================================================
       PUBLIC  –  downloadDealCard
       ============================================================ */
    function downloadDealCard(deal) {
        // Guard: jsPDF must be loaded
        if (!window.jspdf || !window.jspdf.jsPDF) {
            if (typeof showToast === 'function') {
                showToast('PDF library failed to load. Check your internet connection.', 'error');
            }
            return;
        }

        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'letter'
        });

        // Draw sections sequentially
        var y = _drawHeader(doc, deal);
        y = _drawKeyInfo(doc, deal, y);
        y = _drawTimeline(doc, deal, y);
        y = _drawTasks(doc, deal, y);
        y = _drawDealInfo(doc, deal, y);
        _drawFooter(doc);

        // Generate filename
        var rawName = deal.property_address
            ? deal.property_address.split(',')[0].trim()
            : deal.name;
        var safeName = (rawName || '').replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_').trim();
        var filename = (safeName || 'Deal_Card') + '_Deal_Card.pdf';

        // Download via Blob (same pattern as calendar.js downloadICS)
        var blob = doc.output('blob');
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /* ---- public API ---- */
    return {
        downloadDealCard: downloadDealCard
    };
})();
