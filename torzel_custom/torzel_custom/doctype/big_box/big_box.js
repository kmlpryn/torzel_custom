// // Copyright (c) 2024, V12 Infotech and contributors
// // For license information, please see license.txt

// // frappe.ui.form.on("Big Box", {
// // 	refresh(frm) {

// // 	},
// // });
// // Client Script (Doctype: Big Box)

// frappe.ui.form.on('Big Box', {
//   // fires whenever the scan_barcode field value changes
//   scan_barcode(frm) {
//     const code = (frm.doc.scan_barcode || '').trim();
//     if (!code) return;

//     // de-dup within the current doc
//     const already = (frm.doc.barcode_list || []).some(r => (r.barcode_number || '').trim() === code);
//     if (already) {
//       frappe.show_alert({ message: `Already added: ${code}`, indicator: 'orange' });
//     } else {
//       const row = frm.add_child('barcode_list');
//       row.barcode_number = code;
//       refresh_field('barcode_list');
//       frappe.show_alert({ message: `Added: ${code}`, indicator: 'green' });
//     }

//     // clear & re-focus for rapid scanning
//     frm.set_value('scan_barcode', '');
//     setTimeout(() => {
//       const fld = frm.get_field('scan_barcode');
//       if (fld && fld.$input) fld.$input.focus();
//     }, 100);
//   },

//   // ensure pressing Enter in the scan field triggers the same logic,
//   // because many scanners send an Enter key
//   refresh(frm) {
//     const fld = frm.get_field('scan_barcode');
//     if (!fld || !fld.$input) return;

//     if (!fld.$input.data('enter-bound')) {
//       fld.$input.on('keydown', (e) => {
//         if (e.key === 'Enter') {
//           e.preventDefault();
//           frm.trigger('scan_barcode');
//         }
//       });
//       fld.$input.data('enter-bound', true);
//     }
//   },

//   // optional: auto-focus when form opens
//   onload_post_render(frm) {
//     const fld = frm.get_field('scan_barcode');
//     if (fld && fld.$input) {
//       setTimeout(() => fld.$input.focus(), 300);
//     }
//   }
// });
// Client Script (Doctype: Big Box)

// frappe.ui.form.on('Big Box', {
//   scan_barcode(frm) {
//     const code = (frm.doc.scan_barcode || '').trim();
//     if (!code) return;

//     // de-dup
//     const exists = (frm.doc.barcode_list || []).some(
//       r => (r.barcode_number || '').trim() === code
//     );
//     if (exists) {
//       frappe.show_alert({ message: `Already added: ${code}`, indicator: 'orange' });
//       frm.set_value('scan_barcode', '');
//       return focusScan(frm);
//     }

//     // add a child row
//     const row = frm.add_child('barcode_list');

//     // IMPORTANT: set via model.set_value so fetch_from fields populate
//     frappe.model.set_value(row.doctype, row.name, 'barcode_number', code)
//       .then(() => {
//         frm.refresh_field('barcode_list'); // repaint to show fetched fields
//         frappe.show_alert({ message: `Added: ${code}`, indicator: 'green' });
//         frm.set_value('scan_barcode', '');
//         focusScan(frm);
//       });
//   },

//   refresh: focusScan,
//   onload_post_render: focusScan,
// });

// function focusScan(frm) {
//   setTimeout(() => {
//     const fld = frm.get_field('scan_barcode');
//     if (!fld || !fld.$input) return;
//     if (!fld.$input.data('enter-bound')) {
//       fld.$input.on('keydown', (e) => {
//         if (e.key === 'Enter') {
//           e.preventDefault();
//           frm.trigger('scan_barcode');
//         }
//       });
//       fld.$input.data('enter-bound', true);
//     }
//     fld.$input.focus();
//   }, 150);
// }



// Minimal Client Script (no lookups; rely on server to validate/resolve)
frappe.ui.form.on('Big Box', {
  scan_barcode(frm) {
    const code = (frm.doc.scan_barcode || '').trim();
    if (!code) return;

    const row = frm.add_child('barcode_list');
    // sets the link field; if it's not an exact Name, server will resolve or throw on save
    frappe.model.set_value(row.doctype, row.name, 'barcode_number', code);
    frm.refresh_field('barcode_list');

    frm.set_value('scan_barcode', '');
    setTimeout(() => frm.get_field('scan_barcode').$input && frm.get_field('scan_barcode').$input.focus(), 120);
  }
});







// Client Script (Doctype: Big Box)

// frappe.ui.form.on('Big Box', {
//   async onload(frm) {
//     // make the child link truly pick-only in the UI
//     const df = frm.get_field('barcode_list')?.grid?.get_field('barcode_number');
//     if (df) df.only_select = 1;  // prevents free-text typing in the grid
//   },

//   async scan_barcode(frm) {
//     const code = (frm.doc.scan_barcode || '').trim();
//     if (!code) return;

//     // dedupe inside the document
//     const exists_in_doc = (frm.doc.barcode_list || []).some(r => (r.barcode_number || '').trim() === code);
//     if (exists_in_doc) {
//       frappe.show_alert({ message: `Already added: ${code}`, indicator: 'orange' });
//       frm.set_value('scan_barcode', '');
//       return focusScan(frm);
//     }

//     // resolve the *actual* linked record name
//     const link_dt = frm.get_field('barcode_list').grid.get_field('barcode_number').options;

//     // first try: does a record with Name == code exist?
//     let link_name = (await frappe.db.exists(link_dt, code)) ? code : null;

//     // fallback: if your barcode is stored in a field (e.g. "barcode"), look it up and use its name
//     if (!link_name) {
//       const r = await frappe.db.get_value(link_dt, { barcode: code }, 'name'); // <-- change "barcode" if your field differs
//       if (r && r.message && r.message.name) link_name = r.message.name;
//     }

//     if (!link_name) {
//       frappe.msgprint({ message: `Barcode <b>${frappe.utils.escape_html(code)}</b> not found in ${link_dt}.`, indicator: 'red' });
//       frm.set_value('scan_barcode', '');
//       return focusScan(frm);
//     }

//     // add the row and set via model.set_value so fetch_from fields populate
//     const row = frm.add_child('barcode_list');
//     await frappe.model.set_value(row.doctype, row.name, 'barcode_number', link_name);

//     frm.refresh_field('barcode_list'); // repaint to show fetched fields
//     frappe.show_alert({ message: `Added: ${code}`, indicator: 'green' });

//     frm.set_value('scan_barcode', '');
//     focusScan(frm);
//   },

//   refresh: focusScan,
//   onload_post_render: focusScan,
// });

// function focusScan(frm) {
//   setTimeout(() => {
//     const fld = frm.get_field('scan_barcode');
//     if (!fld || !fld.$input) return;
//     if (!fld.$input.data('enter-bound')) {
//       fld.$input.on('keydown', (e) => {
//         if (e.key === 'Enter') { e.preventDefault(); frm.trigger('scan_barcode'); }
//       });
//       fld.$input.data('enter-bound', true);
//     }
//     fld.$input.focus();
//   }, 120);
// }
