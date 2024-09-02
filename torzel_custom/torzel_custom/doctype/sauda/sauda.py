# Copyright (c) 2024, V12 Infotech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class Sauda(Document):
    def validate(self):
        self.calculate_amount_in_sauda_item_table()
        self.calculate_total_quantity()
        self.calculate_total_amount()
        self.check_expiry_date()

    def calculate_total_quantity(self):
        """
        Calculate the total quantity from the Sauda Item child table and set it in the total_quantity field.
        """
        total_quantity = 0

        for item in self.get("sauda_item_table"):
            total_quantity += item.quantity or 0

        self.total_quantity = total_quantity
        
    def calculate_total_amount(self):
        """
        Calculate the total amount from the Sauda Item child table and set it in the total_amount field.
        """
        total_amount = 0

        for item in self.get("sauda_item_table"):
            total_amount += item.amount or 0

        self.total_amount = total_amount
    
    def calculate_amount_in_sauda_item_table(self):
        for item in self.get("sauda_item_table"):
            item.amount = (item.quantity or 0) * (item.rate or 0)
            
    def check_expiry_date(self):
        if self.expiry_date and self.date:
            if self.expiry_date < self.date:
                frappe.throw(("Expiry Date must be same or greater than Document Date."))