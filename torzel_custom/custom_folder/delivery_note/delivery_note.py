import frappe

def before_submit(doc, method):
    check_unique_items(doc)

def check_unique_items(doc):
    for item in doc.items:
        # Check if this item exists in any other Delivery Note, excluding returned items
        existing_delivery_note = frappe.db.sql("""
            SELECT parent FROM `tabDelivery Note Item`
            WHERE item_code = %s
            AND parent != %s
            AND EXISTS (
                SELECT name FROM `tabDelivery Note`
                WHERE `tabDelivery Note`.name = `tabDelivery Note Item`.parent
                AND `tabDelivery Note`.docstatus = 1
                AND `tabDelivery Note`.is_return != 1
            )
        """, (item.item_code, doc.name))

        if existing_delivery_note:
            frappe.throw(
                f"Item {item.item_code} already exists in another Delivery Note ({existing_delivery_note[0][0]})."
                " You can only add returned items."
            )
