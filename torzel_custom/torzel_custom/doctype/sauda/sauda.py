# Copyright (c) 2024, V12 Infotech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class Sauda(Document):
    def validate(self):
        self.calculate_total_quantity()

    def calculate_total_quantity(self):
        """
        Calculate the total quantity from the Sauda Item child table and set it in the total_quantity field.
        """
        total_quantity = 0

        for item in self.get("sauda_item_table"):
            total_quantity += item.quantity or 0

        self.total_quantity = total_quantity
