// Copyright (c) 2024, V12 Infotech and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Big Box", {
// 	refresh(frm) {

// 	},
// });
// Client Script (Doctype: Big Box)

frappe.ui.form.on('Big Box', {
  // fires whenever the scan_barcode field value changes
  scan_barcode(frm) {
    const code = (frm.doc.scan_barcode || '').trim();
    if (!code) return;

    // de-dup within the current doc
    const already = (frm.doc.barcode_list || []).some(r => (r.barcode_number || '').trim() === code);
    if (already) {
      frappe.show_alert({ message: `Already added: ${code}`, indicator: 'orange' });
    } else {
      const row = frm.add_child('barcode_list');
      row.barcode_number = code;
      refresh_field('barcode_list');
      frappe.show_alert({ message: `Added: ${code}`, indicator: 'green' });
    }

    // clear & re-focus for rapid scanning
    frm.set_value('scan_barcode', '');
    setTimeout(() => {
      const fld = frm.get_field('scan_barcode');
      if (fld && fld.$input) fld.$input.focus();
    }, 100);
  },

  // ensure pressing Enter in the scan field triggers the same logic,
  // because many scanners send an Enter key
  refresh(frm) {
    const fld = frm.get_field('scan_barcode');
    if (!fld || !fld.$input) return;

    if (!fld.$input.data('enter-bound')) {
      fld.$input.on('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          frm.trigger('scan_barcode');
        }
      });
      fld.$input.data('enter-bound', true);
    }
  },

  // optional: auto-focus when form opens
  onload_post_render(frm) {
    const fld = frm.get_field('scan_barcode');
    if (fld && fld.$input) {
      setTimeout(() => fld.$input.focus(), 300);
    }
  }
});
