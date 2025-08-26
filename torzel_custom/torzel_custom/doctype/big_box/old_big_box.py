# Copyright (c) 2024, V12 Infotech and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document
import frappe
from frappe import _


class BigBox(Document):
    
	def validate(self):
		"""
		Validate that each barcode in the Big Box is not already delivered or in another Big Box.
		"""

		for barcode in self.barcode_list:
			# Check if the barcode is already marked as delivered in Delivery Note or Sales Invoice
			if self.is_barcode_delivered(barcode.barcode_number):
				frappe.throw(
					_("Barcode {0} is already marked as delivered and cannot be added to this Big Box.").format(
						barcode.barcode_number
					)
				)

			# Check if the barcode already exists in another Big Box
			if self.is_barcode_in_another_bigbox(barcode.barcode_number, self.name):
				frappe.throw(
					_("Barcode {0} already exists in another Big Box and cannot be added here.").format(
						barcode.barcode_number
					)
				)

	def is_barcode_delivered(self,barcode_number):
		"""
		Check if the barcode is marked as delivered in Delivery Note or Sales Invoice.
		"""
		# Check for existence in Delivery Note or Sales Invoice items
		delivery_note_exists = frappe.db.exists(
			"Delivery Note Item",
			{"barcode": barcode_number, "parentfield": "items", "docstatus": 1}
		)
		sales_invoice_exists = frappe.db.exists(
			"Sales Invoice Item",
			{"barcode": barcode_number, "parentfield": "items", "docstatus": 1}
		)

		# Return True if found in either doc type, meaning it's delivered
		return bool(delivery_note_exists or sales_invoice_exists)

	def is_barcode_in_another_bigbox(self, barcode_number, current_bigbox_name):
		"""
		Check if the barcode already exists in another Big Box.
		"""
		bigbox_exists = frappe.db.sql("""
			SELECT parent FROM `tabBig Box Item`
			WHERE barcode_number = %s AND parent != %s
			AND EXISTS (
				SELECT name FROM `tabBig Box`
				WHERE `tabBig Box`.name = parent
				AND `tabBig Box`.docstatus < 2  -- Check for both Draft and Submitted status
			)
		""", (barcode_number, current_bigbox_name))

		return bool(bigbox_exists)

