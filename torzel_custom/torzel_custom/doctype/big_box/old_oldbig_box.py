# Copyright (c) 2024, V12 Infotech and contributors
# For license information, please see license.txt

from frappe.model.document import Document
import frappe
from frappe import _


class BigBox(Document):

	def validate(self):
		"""
		Server-side gates:
		1) Each child row's barcode_number must resolve to a valid Link record.
		   - If user pasted a raw code (not the actual Name), map it to the linked doc's Name.
		   - If no match is found, block save/submit.
		2) No duplicates within the same Big Box.
		3) Barcode must not already be delivered (DN/SI) or present in another Big Box (Draft/Submitted).
		"""
		link_dt = self._get_barcode_link_doctype()
		seen = set()
		missing = []

		for d in (self.barcode_list or []):
			raw = (d.barcode_number or "").strip()
			if not raw:
				continue

			# Resolve to the actual name of the linked record
			resolved_name = self._resolve_barcode_link(link_dt, raw)

			if not resolved_name:
				missing.append(f"{d.idx}: {raw}")
				continue

			# Normalize the child value to the resolved Name (ensures true Link integrity)
			if raw != resolved_name:
				d.barcode_number = resolved_name
  

            



			# Intra-document duplicate check
			if resolved_name in seen:
				frappe.throw(
					_("Duplicate barcode in this Big Box: {0} (row {1})").format(raw, d.idx),
					title=_("Duplicate Barcode")
				)
			seen.add(resolved_name)

			# Delivered elsewhere?
			if self.is_barcode_delivered(resolved_name):
				frappe.throw(
					_("Barcode {0} is already marked as delivered and cannot be added to this Big Box.").format(raw)
				)

			# Already present in another Big Box?
			if self.is_barcode_in_another_bigbox(resolved_name, self.name):
				frappe.throw(
					_("Barcode {0} already exists in another Big Box and cannot be added here.").format(raw)
				)

		# Block save/submit if any unresolved barcodes remain
		if missing:
			frappe.throw(
				_("These barcodes were not found in {0}: {1}")
				.format(link_dt, ", ".join(missing)),
				title=_("Barcode Validation Failed")
			)

	def _get_barcode_link_doctype(self) -> str:
		"""
		Discover which DocType 'barcode_number' links to, from the child meta.
		"""
		meta = frappe.get_meta("Big Box Item")
		df = meta.get_field("barcode_number")
		if not df or not df.options:
			frappe.throw(_("Child field 'barcode_number' is not a Link or has no options set."))
		return df.options  # the linked DocType

	def _resolve_barcode_link(self, link_dt: str, value: str) -> str | None:
		"""
		Given a user-entered value, resolve it to the actual Name of the linked record.
		Try:
		  1) direct Name match
		  2) lookups by common barcode fields (adjust the list if your schema differs)
		Returns the resolved Name or None if not found.
		"""
		# 1) direct name
		if frappe.db.exists(link_dt, value):
			return value

		# 2) lookup by plausible fields
		candidate_fields = ("barcode", "bar_code", "barcode_number", "serial_no")
		for fld in candidate_fields:
			# skip invalid fields on the target doctype gracefully
			try:
				name = frappe.db.get_value(link_dt, {fld: value}, "name")
			except Exception:
				name = None
			if name:
				return name

		return None

	def is_barcode_delivered(self, barcode_name: str) -> bool:
		"""
		Check if the barcode is marked as delivered in Delivery Note or Sales Invoice.
		Assumes your DN/SI Item has a field 'barcode' storing the same identifier you keep in Big Box Item
		(i.e., the linked record's Name or the canonical code you resolved to).
		"""
		delivery_note_exists = frappe.db.exists(
			"Delivery Note Item",
			{"barcode": barcode_name, "parentfield": "items", "docstatus": 1}
		)
		sales_invoice_exists = frappe.db.exists(
			"Sales Invoice Item",
			{"barcode": barcode_name, "parentfield": "items", "docstatus": 1}
		)
		return bool(delivery_note_exists or sales_invoice_exists)

	def is_barcode_in_another_bigbox(self, barcode_name: str, current_bigbox_name: str) -> bool:
		"""
		Check if the barcode already exists in another Big Box (Draft or Submitted).
		"""
		bigbox_exists = frappe.db.sql("""
			SELECT parent FROM `tabBig Box Item`
			WHERE barcode_number = %s AND parent != %s
			AND EXISTS (
				SELECT name FROM `tabBig Box`
				WHERE `tabBig Box`.name = parent
				AND `tabBig Box`.docstatus < 2
			)
		""", (barcode_name, current_bigbox_name))
		return bool(bigbox_exists)
