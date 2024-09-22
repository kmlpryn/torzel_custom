frappe.ui.form.on('Delivery Note', {
    scan_barcode: function (frm) {
        return scan_barcode_and_populate_items(frm);
    },
});


async function scan_barcode_and_populate_items(frm) {
    let scanned_barcode = frm.doc.scan_barcode;

    if (!scanned_barcode) {
        return;
    }

    let barcode_doc = null;
    let bigbox_doc = null;

    if (await frappe.db.exists('Barcode Generator', scanned_barcode)) {
        try {
            // Try to fetch the Barcode Doctype
            barcode_doc = await frappe.db.get_doc('Barcode Generator', scanned_barcode);
            if (barcode_doc) {
                // If barcode exists in Barcode Generator Doctype, populate the items
                await populate_items_from_barcode(frm, barcode_doc, null);
            }
        } catch (e) {
            console.log('Barcode not found in Barcode Doctype, checking BigBox Doctype...');
        }

    } else if (await frappe.db.exists('Big Box', scanned_barcode)) {
        bigbox_doc = await frappe.db.get_doc('Big Box', scanned_barcode);

        if (bigbox_doc) {
            // Populate items from the Barcode Doctype linked inside BigBox
            for (let barcode of bigbox_doc.barcode_list) {
                let inner_barcode_doc = await frappe.db.get_doc('Barcode Generator', barcode.barcode_number);
                if (inner_barcode_doc) {
                    await populate_items_from_barcode(frm, inner_barcode_doc, bigbox_doc);
                }
            }
        }
    } else {
        frappe.msgprint(__('No matching barcode found in Barcode Generator or Big Box.'));
    }

    frm.set_value('scan_barcode', '');
}

async function populate_items_from_barcode(frm, barcode_doc, bigbox_doc) {
    if (barcode_doc) {
        let item_doc = await frappe.db.get_doc('Item', barcode_doc.finished_product);
        // Check if the first row in the items table exists
        let row;

        if (frm.doc.items && frm.doc.items.length === 1 && !frm.doc.items[0].item_code) {
            // Append data to the first row
            row = frm.doc.items[0];
        } else {
            // No rows exist, so add a new row
            row = frm.add_child('items');
        }
        row.qty = barcode_doc.gross_weight - barcode_doc.tare_weight;
        row.item_code = item_doc.name;
        row.item_name = item_doc.item_name;
        row.rate = item_doc.standard_rate || 0;
        row.uom = item_doc.stock_uom;
        row.barcode = barcode_doc.name;
        row.custom_barcode_link = barcode_doc.name;
        row.custom_gross_weight = barcode_doc.gross_weight;
        row.custom_tare_weight = barcode_doc.tare_weight;
        row.custom_big_box_barcode = bigbox_doc ? bigbox_doc.name : null
        // Set other fields as necessary
        frm.refresh_field('items');
    }
}
