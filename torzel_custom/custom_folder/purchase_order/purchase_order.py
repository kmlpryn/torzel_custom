import frappe
from frappe import _

def custom_validate_gate_pass(doc, method):
    """
    Custom validation function to enforce Gate Pass quantity validation on a specific Doctype.
    """
    if doc.custom_gate_pass:
        # Fetch the total gross weight quantity from the linked Gate Pass
        gate_pass = frappe.get_doc("Gate Pass", doc.custom_gate_pass)
        total_gw_qty = gate_pass.total_gw_qty or 0

        # Compare with the total quantity in the target Doctype
        if doc.total_qty > total_gw_qty:
            frappe.throw(
                _("Total Quantity ({0}) should not be greater than Gate Pass accepted Quantity ({1}).")
                .format(doc.total_qty, total_gw_qty),
                title=_("Validation Error")
            )


