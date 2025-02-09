import frappe
from frappe.utils.print_format import get_available_print_formats as original_get_available_print_formats

@frappe.whitelist()
def get_available_print_formats(doctype, docname=None):
    """Override Frappe's print format fetching to filter formats based on the Barcode Generator's brand field."""

    if doctype != "Barcode Generator" or not docname:
        return original_get_available_print_formats(doctype)

    # Get the document to check the brand field
    doc = frappe.get_doc("Barcode Generator", docname)

    if not doc.brand:
        return original_get_available_print_formats(doctype)

    brand_lower = doc.brand.lower()

    # Fetch and filter print formats
    print_formats = frappe.get_all("Print Format",
        filters={"doc_type": "Barcode Generator"},
        fields=["name"]
    )

    filtered_formats = [pf["name"] for pf in print_formats if pf["name"].lower().startswith(brand_lower)]

    return filtered_formats
