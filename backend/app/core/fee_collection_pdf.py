"""Pure PDF renderers for the fee-collection module (vouchers, receipts, family ledgers) —
plain dicts in, PDF bytes out, same style as app/core/pdf_render.py."""

import io
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, A5, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.pdf_render import LIGHT_GREY, PRIMARY

COPY_LABELS = ("BANK COPY", "SCHOOL COPY", "STUDENT COPY")


def _money(value: float) -> str:
    return f"{value:,.0f}"


def _fmt_date(value: date | None) -> str:
    return value.strftime("%d-%b-%Y") if value else "-"


def _clip(c: canvas.Canvas, text: str, max_width: float, font: str, size: float) -> str:
    if c.stringWidth(text, font, size) <= max_width:
        return text
    while text and c.stringWidth(text + "...", font, size) > max_width:
        text = text[:-1]
    return text + "..."


def _draw_voucher_copy(c: canvas.Canvas, x: float, y_top: float, width: float, height: float, label: str, v: dict) -> None:
    pad = 4 * mm
    left = x + pad
    right = x + width - pad
    inner = right - left

    c.setStrokeColor(colors.grey)
    c.setLineWidth(0.6)
    c.rect(x, y_top - height, width, height)

    # Header band
    band_h = 16 * mm
    c.setFillColor(PRIMARY)
    c.rect(x, y_top - band_h, width, band_h, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(x + width / 2, y_top - 7 * mm, _clip(c, v["tenant_name"], inner, "Helvetica-Bold", 11))
    c.setFont("Helvetica", 8)
    c.drawCentredString(x + width / 2, y_top - 12 * mm, f"FEE VOUCHER  -  {label}")

    y = y_top - band_h - 6 * mm
    c.setFillColor(colors.black)
    info = [
        ("Voucher #", v["invoice_number"]),
        ("Student", v["student_name"]),
        ("Adm. No.", v.get("admission_number") or "-"),
        ("Class", v.get("class_name") or "-"),
        ("Family No.", v.get("family_number") or "-"),
        ("Period", v.get("period_label") or "-"),
        ("Issue Date", _fmt_date(v.get("issue_date"))),
        ("Due Date", _fmt_date(v.get("due_date"))),
    ]
    for key, value in info:
        c.setFont("Helvetica-Bold", 8)
        c.drawString(left, y, key)
        c.setFont("Helvetica", 8)
        c.drawString(left + 22 * mm, y, _clip(c, str(value), inner - 22 * mm, "Helvetica", 8))
        y -= 4.6 * mm

    # Line items
    y -= 1.5 * mm
    c.setFillColor(LIGHT_GREY)
    c.rect(left, y - 1.5 * mm, inner, 5.5 * mm, fill=1, stroke=0)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(left + 1 * mm, y, "Particulars")
    c.drawRightString(right - 1 * mm, y, "Amount (PKR)")
    y -= 6 * mm
    c.setFont("Helvetica", 8)
    for line in v["lines"]:
        c.drawString(left + 1 * mm, y, _clip(c, line["description"], inner - 28 * mm, "Helvetica", 8))
        c.drawRightString(right - 1 * mm, y, _money(line["amount"]))
        y -= 4.4 * mm

    c.setLineWidth(0.4)
    c.line(left, y + 2.5 * mm, right, y + 2.5 * mm)
    y -= 1 * mm

    def total_row(label_: str, value: float, bold: bool = False) -> None:
        nonlocal y
        font = "Helvetica-Bold" if bold else "Helvetica"
        c.setFont(font, 8.5 if bold else 8)
        c.drawString(left + 1 * mm, y, label_)
        c.drawRightString(right - 1 * mm, y, _money(value))
        y -= 4.6 * mm

    total_row("Gross Total", v["gross"])
    if v.get("concession"):
        total_row("Less: Concession / Discount", -v["concession"])
    if v.get("late_fee_applied"):
        total_row("Late Fee Fine", v["late_fee_applied"])
    if v.get("paid"):
        total_row("Less: Already Paid", -v["paid"])
    if v.get("arrears"):
        total_row("Previous Arrears", v["arrears"])
    y -= 1 * mm
    c.setFillColor(LIGHT_GREY)
    c.rect(left, y - 1.8 * mm, inner, 6 * mm, fill=1, stroke=0)
    c.setFillColor(colors.black)
    total_row("Payable by Due Date", v["payable"], bold=True)
    if v.get("late_fee_after_due"):
        total_row(f"Payable after Due Date (+{_money(v['late_fee_after_due'])} fine)", v["payable"] + v["late_fee_after_due"], bold=True)

    # Footer
    c.setFont("Helvetica-Oblique", 7)
    c.setFillColor(colors.grey)
    foot_y = y_top - height + 14 * mm
    if v.get("notes"):
        c.drawString(left, foot_y + 5 * mm, _clip(c, v["notes"], inner, "Helvetica-Oblique", 7))
    c.drawString(left, foot_y, "Please pay before the due date to avoid late fee.")
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 7.5)
    c.line(left, y_top - height + 7 * mm, left + 30 * mm, y_top - height + 7 * mm)
    c.drawString(left, y_top - height + 4 * mm, "Cashier / Bank Stamp")
    c.line(right - 30 * mm, y_top - height + 7 * mm, right, y_top - height + 7 * mm)
    c.drawRightString(right, y_top - height + 4 * mm, "Officer Signature")


def render_fee_vouchers(vouchers: list[dict]) -> bytes:
    """One landscape A4 page per voucher, three identical copies (bank / school / student)
    side-by-side separated by dashed cut lines."""
    buffer = io.BytesIO()
    page_w, page_h = landscape(A4)
    c = canvas.Canvas(buffer, pagesize=(page_w, page_h))
    margin = 8 * mm
    gap = 6 * mm
    copy_w = (page_w - 2 * margin - 2 * gap) / 3
    copy_h = page_h - 2 * margin

    if not vouchers:
        c.setFont("Helvetica", 12)
        c.drawCentredString(page_w / 2, page_h / 2, "No vouchers to print for this selection.")
        c.showPage()

    for v in vouchers:
        for i, label in enumerate(COPY_LABELS):
            x = margin + i * (copy_w + gap)
            _draw_voucher_copy(c, x, page_h - margin, copy_w, copy_h, label, v)
            if i < 2:
                c.setDash(3, 3)
                c.setStrokeColor(colors.grey)
                cut_x = x + copy_w + gap / 2
                c.line(cut_x, margin, cut_x, page_h - margin)
                c.setDash()
        c.showPage()
    c.save()
    return buffer.getvalue()


def _styles():
    styles = getSampleStyleSheet()
    return (
        styles,
        ParagraphStyle("FcTitle", parent=styles["Title"], textColor=PRIMARY, fontSize=16, spaceAfter=2),
        ParagraphStyle("FcSub", parent=styles["Normal"], alignment=TA_CENTER, fontSize=10),
    )


def _grid_table(rows: list[list], col_widths: list[float], header: bool = True, font_size: float = 9) -> Table:
    t = Table(rows, colWidths=col_widths, repeatRows=1 if header else 0)
    style = [
        ("FONTSIZE", (0, 0), (-1, -1), font_size),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    if header:
        style += [
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GREY]),
        ]
    t.setStyle(TableStyle(style))
    return t


def render_payment_receipt(r: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A5, topMargin=12 * mm, bottomMargin=12 * mm, leftMargin=12 * mm, rightMargin=12 * mm
    )
    styles, title_style, sub_style = _styles()
    story = [
        Paragraph(r["tenant_name"], title_style),
        Paragraph("Fee Payment Receipt", sub_style),
        Spacer(1, 6 * mm),
    ]
    info = Table(
        [
            ["Receipt #", r["receipt_number"], "Date", _fmt_date(r["collected_on"])],
            ["Received from", r["payer_name"], "Method", r["payment_method"]],
            ["Family No.", r.get("family_number") or "-", "Collected by", r.get("collected_by_name") or "-"],
        ],
        colWidths=[24 * mm, 40 * mm, 22 * mm, 38 * mm],
    )
    info.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("BACKGROUND", (0, 0), (0, -1), LIGHT_GREY),
                ("BACKGROUND", (2, 0), (2, -1), LIGHT_GREY),
            ]
        )
    )
    story += [info, Spacer(1, 5 * mm)]
    rows = [["Voucher #", "Student", "Paid", "Balance"]] + [
        [a["invoice_number"], a["student_name"], _money(a["amount"]), _money(a["balance_after"])]
        for a in r["allocations"]
    ]
    rows.append(["", "Total Received", _money(r["total_amount"]), ""])
    t = _grid_table(rows, [24 * mm, 54 * mm, 23 * mm, 23 * mm], font_size=8.5)
    t.setStyle(TableStyle([("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"), ("ALIGN", (2, 0), (3, -1), "RIGHT")]))
    story += [t, Spacer(1, 4 * mm)]
    if r.get("reference_note"):
        story.append(Paragraph(f"Reference: {r['reference_note']}", styles["Normal"]))
    story += [
        Spacer(1, 12 * mm),
        Paragraph("This is a computer-generated receipt.", ParagraphStyle("FcFoot", parent=styles["Italic"], fontSize=8)),
    ]
    doc.build(story)
    return buffer.getvalue()


def render_family_ledger(d: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, topMargin=14 * mm, bottomMargin=14 * mm, leftMargin=12 * mm, rightMargin=12 * mm
    )
    styles, title_style, sub_style = _styles()
    story = [
        Paragraph(d["tenant_name"], title_style),
        Paragraph("Fee Ledger / Statement of Account", sub_style),
        Spacer(1, 5 * mm),
        Paragraph(f"<b>Account:</b> {d['account_label']}", styles["Normal"]),
        Paragraph(f"<b>Students:</b> {d['students_label']}", styles["Normal"]),
        Paragraph(f"<b>Printed on:</b> {_fmt_date(date.today())}", styles["Normal"]),
        Spacer(1, 5 * mm),
    ]
    rows = [["Date", "Reference", "Description", "Student", "Debit", "Credit", "Balance"]]
    for e in d["entries"]:
        rows.append(
            [
                _fmt_date(e["entry_date"]),
                e["reference"],
                Paragraph(e["description"], ParagraphStyle("FcCell", parent=styles["Normal"], fontSize=8)),
                Paragraph(e["student_name"], ParagraphStyle("FcCell2", parent=styles["Normal"], fontSize=8)),
                _money(e["debit"]) if e["debit"] else "",
                _money(e["credit"]) if e["credit"] else "",
                _money(e["balance"]),
            ]
        )
    rows.append(["", "", "Totals", "", _money(d["total_billed"]), _money(d["total_paid"]), _money(d["closing_balance"])])
    t = _grid_table(rows, [22 * mm, 22 * mm, 50 * mm, 34 * mm, 20 * mm, 20 * mm, 20 * mm], font_size=8)
    t.setStyle(TableStyle([("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"), ("ALIGN", (4, 0), (6, -1), "RIGHT")]))
    story.append(t)
    doc.build(story)
    return buffer.getvalue()
