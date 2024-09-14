import frappe
from frappe.query_builder import DocType
from frappe.query_builder.functions import Sum, IfNull
from pypika.enums import Order  # Import the correct enum for ordering

def execute(filters=None):
    Sauda = DocType("Sauda")
    GatePass = DocType("Gate Pass")
    
    # Build the base query
    query = (
        frappe.qb
        .from_(Sauda)
        .left_join(GatePass)
        .on(GatePass.sauda == Sauda.name)
        .select(
            Sauda.name.as_("sauda_name"),
            Sauda.supplier.as_("customer"),
            Sauda.expiry_date.as_("expiry_date"),
            (frappe.qb.terms.Case()
                .when(Sauda.expiry_date < frappe.utils.nowdate(), "Yes")
                .else_("No")).as_("Expired"),  # Return "Yes" or "No"
            Sauda.total_quantity.as_("sauda_total_quantity"),
            IfNull(Sum(GatePass.total_gw_qty), 0).as_("total_gate_pass_quantity"),
            (Sauda.total_quantity - IfNull(Sum(GatePass.total_gw_qty), 0)).as_("remaining_quantity")
        )
        .where(Sauda.docstatus == 1)
        .groupby(Sauda.name)
        .having((Sauda.total_quantity - IfNull(Sum(GatePass.total_gw_qty), 0)) > 0)
        .orderby(Sauda.total_quantity - IfNull(Sum(GatePass.total_gw_qty), 0), order=Order.desc)
    )

    # Apply from_date filter if provided
    if filters.get('from_date'):
        query = query.where(Sauda.expiry_date >= filters['from_date'])

    # Apply to_date filter if provided
    if filters.get('to_date'):
        query = query.where(Sauda.expiry_date <= filters['to_date'])

    # Execute the query and return the data
    data = query.run(as_dict=True)

    # Define the columns to be displayed in the report
    columns = [
        {"fieldname": "sauda_name", "label": "Sauda Name", "fieldtype": "Link", "options": "Sauda", "width": 150},
        {"fieldname": "customer", "label": "Supplier", "fieldtype": "Data", "width": 150},
        {"fieldname": "expiry_date", "label": "Expiry Date", "fieldtype": "Date", "width": 120},
        {"fieldname": "Expired", "label": "Expired", "fieldtype": "Data", "width": 100},  # Expired column returns Yes/No
        {"fieldname": "sauda_total_quantity", "label": "Sauda Total Quantity", "fieldtype": "Float", "width": 150},
        {"fieldname": "total_gate_pass_quantity", "label": "Total Gate Pass Quantity", "fieldtype": "Float", "width": 150},
        {"fieldname": "remaining_quantity", "label": "Remaining Quantity", "fieldtype": "Float", "width": 150}
    ]

    return columns, data
