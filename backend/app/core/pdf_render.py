"""Pure PDF-rendering functions — take plain data in, return PDF bytes out. No DB access here
(that's app/services/document_service.py's job) so these stay easy to test/tweak in isolation.
"""

import io
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

PRIMARY = colors.HexColor("#1a3c6e")
LIGHT_GREY = colors.HexColor("#f2f4f7")


def render_report_card(
    *,
    tenant_name: str,
    student_name: str,
    class_name: str,
    roll_number: str | None,
    admission_number: str | None,
    period_label: str,
    attendance_percent: float,
    assignments: list[dict],
    quizzes: list[dict],
    overall_percent: float | None,
    grade: str | None,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm, leftMargin=18 * mm, rightMargin=18 * mm
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Title"], textColor=PRIMARY, fontSize=18)
    subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"], alignment=TA_CENTER, fontSize=11)
    heading_style = ParagraphStyle("SectionHeading", parent=styles["Heading2"], textColor=PRIMARY, fontSize=13)

    story = [
        Paragraph(tenant_name, title_style),
        Paragraph("Student Report Card", subtitle_style),
        Spacer(1, 10 * mm),
    ]

    info_table = Table(
        [
            ["Student Name", student_name, "Class", class_name],
            ["Roll Number", roll_number or "—", "Admission No.", admission_number or "—"],
            ["Period", period_label, "Attendance", f"{attendance_percent:.1f}%"],
        ],
        colWidths=[35 * mm, 55 * mm, 35 * mm, 45 * mm],
    )
    info_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("BACKGROUND", (0, 0), (0, -1), LIGHT_GREY),
                ("BACKGROUND", (2, 0), (2, -1), LIGHT_GREY),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(info_table)
    story.append(Spacer(1, 8 * mm))

    story.append(Paragraph("Assignments", heading_style))
    story.append(Spacer(1, 2 * mm))
    if assignments:
        rows = [["Title", "Marks Obtained", "Max Marks"]] + [
            [a["title"], "—" if a["marks_obtained"] is None else str(a["marks_obtained"]), str(a["max_marks"])]
            for a in assignments
        ]
        t = Table(rows, colWidths=[90 * mm, 40 * mm, 40 * mm])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GREY]),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(t)
    else:
        story.append(Paragraph("No assignments recorded for this period.", styles["Normal"]))
    story.append(Spacer(1, 8 * mm))

    story.append(Paragraph("Quizzes", heading_style))
    story.append(Spacer(1, 2 * mm))
    if quizzes:
        rows = [["Title", "Score", "Max Score"]] + [
            [q["title"], "—" if q["score"] is None else str(q["score"]), str(q["max_score"])] for q in quizzes
        ]
        t = Table(rows, colWidths=[90 * mm, 40 * mm, 40 * mm])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GREY]),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(t)
    else:
        story.append(Paragraph("No quizzes recorded for this period.", styles["Normal"]))
    story.append(Spacer(1, 10 * mm))

    overall_text = "Overall: " + (f"{overall_percent:.1f}% (Grade {grade})" if overall_percent is not None else "Not yet available")
    story.append(Paragraph(overall_text, ParagraphStyle("Overall", parent=styles["Heading2"], textColor=PRIMARY)))

    doc.build(story)
    return buffer.getvalue()


def render_id_card(
    *,
    tenant_name: str,
    student_name: str,
    class_name: str,
    roll_number: str | None,
    admission_number: str | None,
) -> bytes:
    buffer = io.BytesIO()
    width, height = 85.6 * mm, 54 * mm  # standard ID-1 card size
    c = canvas.Canvas(buffer, pagesize=(width, height))

    c.setFillColor(PRIMARY)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.roundRect(3 * mm, 3 * mm, width - 6 * mm, height - 6 * mm, 3, fill=1, stroke=0)

    c.setFillColor(PRIMARY)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(width / 2, height - 9 * mm, tenant_name[:40])
    c.setFont("Helvetica", 6.5)
    c.drawCentredString(width / 2, height - 12.5 * mm, "STUDENT IDENTITY CARD")

    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(width / 2, height - 22 * mm, student_name[:35])

    c.setFont("Helvetica", 8)
    lines = [
        f"Class: {class_name}",
        f"Roll No.: {roll_number or '—'}",
        f"Admission No.: {admission_number or '—'}",
    ]
    y = height - 28 * mm
    for line in lines:
        c.drawCentredString(width / 2, y, line)
        y -= 4.2 * mm

    c.setFont("Helvetica-Oblique", 6)
    c.setFillColor(colors.grey)
    c.drawCentredString(width / 2, 4.5 * mm, "Valid for current academic year only")

    c.showPage()
    c.save()
    return buffer.getvalue()


def render_certificate(
    *,
    tenant_name: str,
    student_name: str,
    class_name: str,
    achievement_text: str,
    issue_date: date,
) -> bytes:
    buffer = io.BytesIO()
    width, height = landscape(A4)
    c = canvas.Canvas(buffer, pagesize=(width, height))

    c.setStrokeColor(PRIMARY)
    c.setLineWidth(3)
    c.rect(12 * mm, 12 * mm, width - 24 * mm, height - 24 * mm)
    c.setLineWidth(0.75)
    c.rect(16 * mm, 16 * mm, width - 32 * mm, height - 32 * mm)

    c.setFillColor(PRIMARY)
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(width / 2, height - 40 * mm, tenant_name)

    c.setFont("Helvetica-Bold", 30)
    c.drawCentredString(width / 2, height - 58 * mm, "Certificate of Achievement")

    c.setFillColor(colors.black)
    c.setFont("Helvetica", 13)
    c.drawCentredString(width / 2, height - 75 * mm, "This certificate is proudly presented to")

    c.setFillColor(PRIMARY)
    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(width / 2, height - 90 * mm, student_name)

    c.setFillColor(colors.black)
    c.setFont("Helvetica", 12)
    c.drawCentredString(width / 2, height - 100 * mm, f"of Class {class_name}")

    c.setFont("Helvetica", 13)
    text = c.beginText(width / 2 - 90 * mm, height - 115 * mm)
    text.setFont("Helvetica", 13)
    text.textLine(achievement_text)
    c.drawCentredString(width / 2, height - 115 * mm, achievement_text)

    c.setFont("Helvetica-Oblique", 10)
    c.drawCentredString(width / 2, 30 * mm, f"Issued on {issue_date.strftime('%d %B, %Y')}")

    c.setFont("Helvetica", 10)
    c.line(width / 2 - 45 * mm, 22 * mm, width / 2 - 5 * mm, 22 * mm)
    c.drawCentredString(width / 2 - 25 * mm, 18 * mm, "Principal / Director")

    c.showPage()
    c.save()
    return buffer.getvalue()
