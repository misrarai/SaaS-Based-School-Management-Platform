"""Gate pass PDF — pure rendering (data in, bytes out), same conventions as app/core/pdf_render.py."""

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A5, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from app.core.pdf_render import LIGHT_GREY, PRIMARY


def render_gate_pass(
    *,
    tenant_name: str,
    pass_number: int,
    student_name: str,
    admission_number: str | None,
    class_label: str,
    reason: str,
    guardian_name: str,
    guardian_relation: str | None,
    guardian_cnic: str | None,
    guardian_phone: str | None,
    out_time: datetime,
    approved_by: str | None,
) -> bytes:
    buffer = io.BytesIO()
    width, height = landscape(A5)
    c = canvas.Canvas(buffer, pagesize=(width, height))

    c.setStrokeColor(PRIMARY)
    c.setLineWidth(2)
    c.rect(8 * mm, 8 * mm, width - 16 * mm, height - 16 * mm)

    c.setFillColor(PRIMARY)
    c.rect(8 * mm, height - 30 * mm, width - 16 * mm, 22 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2, height - 18 * mm, tenant_name[:60])
    c.setFont("Helvetica", 10)
    c.drawCentredString(width / 2, height - 25 * mm, "STUDENT GATE PASS")

    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(14 * mm, height - 38 * mm, f"Pass No.: {pass_number:05d}")
    c.drawRightString(width - 14 * mm, height - 38 * mm, f"Date/Time: {out_time.strftime('%d %b %Y  %I:%M %p')}")

    rows = [
        ("Student Name", student_name),
        ("Admission No.", admission_number or "—"),
        ("Class", class_label or "—"),
        ("Reason", reason),
        ("Picked up by", guardian_name + (f" ({guardian_relation})" if guardian_relation else "")),
        ("Guardian CNIC", guardian_cnic or "—"),
        ("Guardian Phone", guardian_phone or "—"),
    ]
    y = height - 48 * mm
    label_x, value_x = 14 * mm, 55 * mm
    for i, (label, value) in enumerate(rows):
        if i % 2 == 0:
            c.setFillColor(LIGHT_GREY)
            c.rect(12 * mm, y - 2.2 * mm, width - 24 * mm, 7 * mm, fill=1, stroke=0)
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(label_x, y, label)
        c.setFont("Helvetica", 10)
        c.drawString(value_x, y, str(value)[:80])
        y -= 7.5 * mm

    sig_y = 20 * mm
    c.setLineWidth(0.7)
    c.setStrokeColor(colors.grey)
    c.line(14 * mm, sig_y, 70 * mm, sig_y)
    c.line(width - 70 * mm, sig_y, width - 14 * mm, sig_y)
    c.setFont("Helvetica", 9)
    c.drawString(14 * mm, sig_y - 4.5 * mm, "Guardian Signature")
    c.drawRightString(width - 14 * mm, sig_y - 4.5 * mm, f"Approved by: {approved_by or '________'}")

    c.setFont("Helvetica-Oblique", 7.5)
    c.setFillColor(colors.grey)
    c.drawCentredString(width / 2, 11 * mm, "Please present this pass at the school gate. Valid for the date shown only.")

    c.showPage()
    c.save()
    return buffer.getvalue()
