# Copyright (c) 2024, V12 Infotech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _

class GatePass(Document):
    def validate(self):
        self.update_tare_weight()
        self.calculate_total_bags()
        self.calculate_total_gw_qty()
        self.calculate_difference_qty()
        self.calculate_difference_bags()
        self.validate_weights()

    def update_tare_weight(self):
        """
        Calculate and update tare weight as the difference between gross weight and net weight.
        """
        if self.gross_weight and self.net_weight:
            self.tare_weight = self.gross_weight - self.net_weight
        else:
            self.tare_weight = None

    def calculate_difference_qty(self):
        """
        Calculate and update the difference in gross weight and total gross weight quantity.
        """
        if self.gross_weight and self.total_gw_qty:
            self.difference_gw = self.gross_weight - self.total_gw_qty
        else:
            self.difference_gw = None

    def calculate_difference_bags(self):
        """
        Calculate and update the difference in bag number and total bags.
        """
        if self.bag_no and self.total_bags:
            self.difference_bags = self.bag_no - self.total_bags    
        else:
            self.difference_bags = None

    def validate_weights(self):
        """
        Validate that the gross weight is not less than the net weight.
        """
        if (self.gross_weight or 0) < (self.net_weight or 0):
            frappe.throw(_("Gross Weight cannot be less than Net Weight"))

    def before_save(self):
        """
        Perform calculations on the child table to ensure consistency.
        """
        self.validate_sauda_quantity()

    def calculate_total_bags(self):
        """
        Calculate the total number of bags from the child table and update the total_bags field.
        """
        total_bags = 0
        for item in self.get("gate_pass_item_table"):
            total_bags += item.bags_no or 0
        self.total_bags = total_bags

    def calculate_total_gw_qty(self):
        """
        Calculate the total gross weight quantity from the child table and update the total_gw_qty field.
        """
        total_gw_qty = 0
        for item in self.get("gate_pass_item_table"):
            total_gw_qty += item.gross_qty or 0
        self.total_gw_qty = total_gw_qty
        
    def validate_sauda_quantity(self):
        """
        Validate that the total Gate Pass quantities linked to a Sauda do not exceed the Sauda's total quantity + deviation.
        """
        deviation = 0.05
        
        if self.sauda:
            sauda = frappe.get_doc('Sauda', self.sauda)
            
            sauda_quantity_with_deviation = sauda.total_quantity + (sauda.total_quantity * deviation)
            
            # Sum quantities of all other Gate Passes linked to the same Sauda, excluding the current one
            total_gate_pass_qty = frappe.db.sql("""
                SELECT SUM(total_gw_qty) FROM `tabGate Pass`
                WHERE sauda = %s AND name != %s
            """, (self.sauda, self.name))[0][0] or 0
            
            # Add the current Gate Pass quantity
            total_gate_pass_qty += self.total_gw_qty
            
            # Validation: Ensure total gate pass quantities do not exceed Sauda's total quantity + deviation
            if (total_gate_pass_qty or 0) > (sauda_quantity_with_deviation or 0):
                frappe.throw(
                    _("The total quantity for Gate Passes ({0} kg) exceeds the total Sauda quantity ({1} kg).")
                    .format(total_gate_pass_qty, sauda_quantity_with_deviation)
                )




   

