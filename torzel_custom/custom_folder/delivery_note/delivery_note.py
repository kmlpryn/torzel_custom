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
                " Please create new barcode."
            )

def get_dispatch_summary_data(doc):
    items = doc.get('items')
    
    # Ensure that items is iterable
    if not items:
        return {}  # Return an empty dictionary if no items

    total_custom_gross_weight = 0
    total_custom_tare_weight = 0
    total_net_weight = 0
    
    grouped_items = []
    current_group = None

    def round_group_totals(g):
       g['gross_weight'] = round(g['gross_weight'], 3)
       g['tare_weight']  = round(g['tare_weight'], 3)
       g['net_weight']   = round(g['net_weight'], 3)
       return g


    # Iterate through the items
    for item in items:
        net_weight = (item.custom_gross_weight or 0) - (item.custom_tare_weight or 0)
        
        # Add to overall totals
        total_custom_gross_weight += item.custom_gross_weight or 0
        total_custom_tare_weight += item.custom_tare_weight or 0
        total_net_weight += net_weight

        # Group the items by item_name
        if not current_group or current_group['item_name'] != item.item_name:
            if current_group:
                grouped_items.append(current_group)
            current_group = {
                'item_name': item.item_name,
                'items': [],
                'gross_weight': 0,
                'tare_weight': 0,
                'net_weight': 0
            }

        # Add the current item to the group
        current_group['items'].append(item)
        current_group['gross_weight'] += item.custom_gross_weight or 0
        current_group['tare_weight'] += item.custom_tare_weight or 0
        current_group['net_weight'] += net_weight

        

    # Append the last group
    if current_group:
        g = round_group_totals(current_group)
        grouped_items.append(g)
     
    # Return the dispatch summary data
    return {
        'grouped_items': grouped_items,
        'total_custom_gross_weight': total_custom_gross_weight,
        'total_custom_tare_weight': total_custom_tare_weight,
        'total_net_weight': total_net_weight
    }

    
# Ensure this data is called before rendering the print format
def before_print_delivery_note(doc, method=None, output=None, **kwargs):
    # Call the function to get dispatch summary data
    doc.dispatch_data = get_dispatch_summary_data(doc)