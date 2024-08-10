// Copyright (c) 2024, V12 Infotech and contributors
// For license information, please see license.txt


frappe.ui.form.on('Sauda Item', {
    quantity: function (frm) {
        calculateTotalQty(frm);
    }
});

function calculateTotalQty(frm) {
    let totalQuantity = 0;

    // Sum the quantity from each item in the sauda_item_table
    (frm.doc.sauda_item_table || []).forEach((item) => {
        totalQuantity += item.quantity || 0;
    });

    // Set the calculated total quantity in the total_quantity field
    frm.set_value('total_quantity', totalQuantity);
}
