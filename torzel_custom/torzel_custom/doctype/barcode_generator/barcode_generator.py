# Copyright (c) 2024, V12 Infotech and contributors
# For license information, please see license.txt
import frappe
from frappe.model.document import Document

class BarcodeGenerator(Document):
    def before_submit(self):
        # Set the barcode field to the document name if it is not already set
        if not self.barcode:
            self.barcode = self.name

    def on_submit(self):
        # Create a Stock Entry when Barcode Generator is submitted
        stock_entry = frappe.get_doc({
            'doctype': 'Stock Entry',
            'naming_series':'BAR-.YYYY.-',
            'stock_entry_type': 'Repack',  # Or appropriate type
            'items': self.get_items(),  # Implement get_items() to extract items from Barcode Generator
            'posting_date': frappe.utils.nowdate()
        })
        stock_entry.insert()
        stock_entry.submit()

        # Link the Stock Entry to the Barcode Generator
        self.db_set('auto_stock_entry_number', stock_entry.name)

    def on_cancel(self):
        # Cancel the linked Stock Entry if the Barcode Generator is canceled
        if self.auto_stock_entry_number:
            stock_entry = frappe.get_doc('Stock Entry', self.auto_stock_entry_number)
            if stock_entry.docstatus == 1:  # If it's submitted, cancel it
                stock_entry.cancel()
            else:
                stock_entry.delete()

    def get_items(self):
        print("Barcode Items", self)
        # Extract items from Barcode Generator to create the Stock Entry items
        items = [{
           'item_code': self.raw_material,
            'qty': self.net_weight,
            's_warehouse': self.source_warehouse,  # Source warehouse (if applicable)
            't_warehouse': None,  # Target warehouse
        },
        {
           'item_code': self.finished_product,
            'qty': self.net_weight,
            's_warehouse': None,  # Source warehouse (if applicable)
            't_warehouse': self.target_warehouse,  # Target warehouse
        }
                 
        ]
          
        return items
    

