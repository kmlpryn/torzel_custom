import frappe

def before_submit(doc, method):
    check_unique_barcodes(doc)
    
def before_save(doc, method):
    check_unique_barcodes(doc)

def check_unique_barcodes(doc):
    # Bypass barcode check if Delivery Note is in return mode
    if doc.is_return == 1:
        return

    # Track barcodes within the same Delivery Note
    barcode_list = []

    for item in doc.items:
        # Assuming each item has a field `barcode` (or replace it with the actual field name)
        if not item.barcode:
            continue  # Skip if no barcode is available for the item

        # Check if this barcode is already in the current Delivery Note (duplicate barcode within the same doc)
        if item.barcode in barcode_list:
            frappe.throw(
                f"Barcode {item.barcode} appears multiple times in the same Delivery Note."
            )

        # Add barcode to the list for internal duplicate check
        barcode_list.append(item.barcode)

        # Check if this barcode exists in any other Delivery Note, excluding returned items
        existing_delivery_note = frappe.db.sql("""
            SELECT parent FROM `tabDelivery Note Item`
            WHERE barcode = %s
            AND parent != %s
            AND EXISTS (
                SELECT name FROM `tabDelivery Note`
                WHERE `tabDelivery Note`.name = `tabDelivery Note Item`.parent
                AND `tabDelivery Note`.docstatus = 1
                AND `tabDelivery Note`.is_return != 1
            )
        """, (item.barcode, doc.name))

        if existing_delivery_note:
            frappe.throw(
                f"Barcode {item.barcode} already exists in another Delivery Note ({existing_delivery_note[0][0]})."
                " You can only add returned items."
            )
