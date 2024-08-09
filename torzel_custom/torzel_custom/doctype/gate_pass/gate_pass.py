# Copyright (c) 2024, V12 Infotech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class GatePass(Document):
    def before_save(self):
 
        if self.sauda:  
            sauda = frappe.get_doc('Sauda', self.sauda)
            
            # Sum quantities of all other Gate Passes linked to the same Sauda, excluding the current one
            total_gate_pass_qty = frappe.db.sql("""
                SELECT SUM(total_gw_qty) FROM `tabGate Pass`
                WHERE sauda = %s AND name != %s
            """, (self.sauda, self.name))[0][0] or 0
            
            # Add the current Gate Pass quantity
            total_gate_pass_qty += self.total_gw_qty

            # Validation: Ensure total gate pass quantities do not exceed Sauda's total quantity
            if total_gate_pass_qty > sauda.total_quantity:
                frappe.throw(f"The total quantity for Gate Passes ({total_gate_pass_qty} kg) exceeds the total Sauda quantity ({sauda.total_quantity} kg).")
        

        if self.gross_weight and self.net_weight:
            self.tare_weight = self.gross_weight - self.net_weight
        
        if self.bag_no and self.total_bags:
            self.difference_bags = self.bag_no - self.total_bags
        
        if self.total_gw_qty and self.gross_weight:
            self.difference_gw = self.gross_weight - self.total_gw_qty
            
        

