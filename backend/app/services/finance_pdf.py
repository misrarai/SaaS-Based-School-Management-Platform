"""Pure PDF renderers for accounting vouchers and point-of-sale receipts."""

import io

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

PRIMARY = colors.HexColor("#1a3c6e")
LIGHT_GREY = colors.HexColor("#f2f4f7")

VOUCHER_TITLES = {
    "CRV": "Cash Receipt Voucher",
    "CPV": "Cash Payment Voucher",
    "BRV": "Bank Receipt Voucher",
    "BPV": "Bank Payment Voucher",
    "JV": "Journal Voucher",
}


def _money(v: float) -> str:
    return f"{v:,.2f}" if v else ""


def _grid(table: Table, header_rows: int = 1) -> None:
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, header_rows - 1), PRIMARY),
                ("TEXTCOLOR", (0, 0), (-1, header_rows - 1), colors.white),
                ("FONTNAME", (0, 0), (-1, header_rows - 1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, header_rows), (-1, -1), [colors.white, LIGHT_GREY]),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )


def render_voucher(*, tenant_name: str, voucher: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=15 * mm, bottomMargin=15 * mm,
                            leftMargin=15 * mm, rightMargin=15 * mm)
    styles = getSampleStyleSheet()
    title = ParagraphStyle("T", parent=styles["Title"], textColor=PRIMARY, fontSize=17)
    sub = ParagraphStyle("S", parent=styles["Normal"], alignment=TA_CENTER, fontSize=12)
    story = [
        Paragraph(tenant_name, title),
        Paragraph(VOUCHER_TITLES.get(voucher["voucher_type"], "Voucher"), sub),
        Spacer(1, 6 * mm),
    ]
    info = Table(
        [
            ["Voucher No.", voucher["voucher_number"], "Date", voucher["voucher_date"]],
            ["Status", voucher["status"].title(), "Reference", voucher.get("reference") or "-"],
            ["Payee / Payer", voucher.get("payee") or "-", "", ""],
            ["Narration", voucher.get("narration") or "-", "", ""],
        ],
        colWidths=[30 * mm, 70 * mm, 25 * mm, 55 * mm],
    )
    info.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("SPAN", (1, 2), (3, 2)),
        ("SPAN", (1, 3), (3, 3)),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_GREY),
    ]))
    story += [info, Spacer(1, 6 * mm)]

    rows = [["#", "Account", "Description", "Debit", "Credit"]]
    for i, line in enumerate(voucher["lines"], start=1):
        rows.append([
            str(i), f"{line.get('account_code') or ''} {line.get('account_name') or ''}".strip(),
            Paragraph(line.get("description") or "", styles["Normal"]),
            _money(line["debit"]), _money(line["credit"]),
        ])
    rows.append(["", "", "Total", f"{voucher['total_debit']:,.2f}", f"{voucher['total_credit']:,.2f}"])
    t = Table(rows, colWidths=[8 * mm, 62 * mm, 60 * mm, 25 * mm, 25 * mm], repeatRows=1)
    _grid(t)
    t.setStyle(TableStyle([
        ("ALIGN", (3, 0), (4, -1), "RIGHT"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
    ]))
    story += [t, Spacer(1, 20 * mm)]

    sig = Table([["Prepared by", "Checked by", "Approved by", "Received by"]],
                colWidths=[45 * mm] * 4)
    sig.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 0.75, colors.black),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
    ]))
    story.append(sig)
    doc.build(story)
    return buffer.getvalue()


def render_sale_receipt(*, tenant_name: str, sale: dict) -> bytes:
    buffer = io.BytesIO()
    width = 80 * mm
    doc = SimpleDocTemplate(buffer, pagesize=(width, 200 * mm), topMargin=6 * mm, bottomMargin=6 * mm,
                            leftMargin=4 * mm, rightMargin=4 * mm)
    styles = getSampleStyleSheet()
    center = ParagraphStyle("C", parent=styles["Normal"], alignment=TA_CENTER, fontSize=9)
    bold_center = ParagraphStyle("BC", parent=center, fontName="Helvetica-Bold", fontSize=11)
    story = [
        Paragraph(tenant_name, bold_center),
        Paragraph("School Shop - Sales Receipt", center),
        Spacer(1, 3 * mm),
        Paragraph(f"Receipt: {sale['txn_number']}<br/>Date: {sale['txn_date']}<br/>"
                  f"Customer: {sale.get('customer_label') or 'Walk-in'}", ParagraphStyle(
                      "L", parent=styles["Normal"], fontSize=8.5)),
        Spacer(1, 3 * mm),
    ]
    rows = [["Item", "Qty", "Price", "Total"]]
    for line in sale["lines"]:
        rows.append([Paragraph(line.get("item_name") or "", ParagraphStyle("I", fontSize=8)),
                     f"{line['quantity']:g}", f"{line['unit_price']:,.2f}", f"{line['line_total']:,.2f}"])
    subtotal = sum(l["line_total"] for l in sale["lines"])
    rows.append(["Subtotal", "", "", f"{subtotal:,.2f}"])
    if sale.get("discount"):
        rows.append(["Discount", "", "", f"-{sale['discount']:,.2f}"])
    rows.append(["TOTAL", "", "", f"{sale['total_amount']:,.2f}"])
    if sale.get("amount_paid") is not None:
        rows.append(["Paid (" + (sale.get("payment_method") or "cash") + ")", "", "", f"{sale['amount_paid']:,.2f}"])
        rows.append(["Change", "", "", f"{max(sale['amount_paid'] - sale['total_amount'], 0):,.2f}"])
    t = Table(rows, colWidths=[32 * mm, 9 * mm, 15 * mm, 16 * mm])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.black),
        ("LINEABOVE", (0, len(sale["lines"]) + 1), (-1, len(sale["lines"]) + 1), 0.5, colors.black),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
    ]))
    story += [t, Spacer(1, 4 * mm), Paragraph("Thank you!", center)]
    doc.build(story)
    return buffer.getvalue()
