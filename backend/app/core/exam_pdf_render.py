"""Pure PDF renderers for the examinations module (datesheet, result card, tabulation sheet).
Plain data in, PDF bytes out — same style as app/core/pdf_render.py."""

import io
from xml.sax.saxutils import escape as _e

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

PRIMARY = colors.HexColor("#1a3c6e")
LIGHT_GREY = colors.HexColor("#f2f4f7")
FAIL_RED = colors.HexColor("#b42318")


def _styles():
    styles = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("ExTitle", parent=styles["Title"], textColor=PRIMARY, fontSize=18, spaceAfter=2),
        "subtitle": ParagraphStyle("ExSub", parent=styles["Normal"], alignment=TA_CENTER, fontSize=11),
        "heading": ParagraphStyle("ExHead", parent=styles["Heading2"], textColor=PRIMARY, fontSize=13),
        "normal": styles["Normal"],
        "cell": ParagraphStyle("ExCell", parent=styles["Normal"], fontSize=8, leading=9.5),
    }


def _grid_style(header_bg=PRIMARY, font_size=9.5) -> list:
    return [
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), font_size),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GREY]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]


def _num(value) -> str:
    if value is None:
        return "—"
    return f"{value:g}" if isinstance(value, float) else str(value)


def _ordinal(n: int | None) -> str:
    if n is None:
        return "—"
    suffix = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def _signatures(width_mm: float) -> Table:
    col = width_mm / 3
    t = Table(
        [["", "", ""], ["Class Teacher", "Examination Controller", "Principal"]],
        colWidths=[col * mm] * 3,
        rowHeights=[14 * mm, 6 * mm],
    )
    t.setStyle(
        TableStyle(
            [
                ("LINEABOVE", (0, 1), (0, 1), 0.75, colors.black),
                ("LINEABOVE", (1, 1), (1, 1), 0.75, colors.black),
                ("LINEABOVE", (2, 1), (2, 1), 0.75, colors.black),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("LEFTPADDING", (0, 0), (-1, -1), 8 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8 * mm),
            ]
        )
    )
    return t


def render_datesheet(*, tenant_name: str, exam_name: str, academic_year: str | None, class_name: str,
                     rows: list[dict]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm,
                            leftMargin=15 * mm, rightMargin=15 * mm)
    s = _styles()
    story = [
        Paragraph(_e(tenant_name), s["title"]),
        Paragraph(f"{_e(exam_name)}{f' ({_e(academic_year)})' if academic_year else ''} — Date Sheet", s["subtitle"]),
        Spacer(1, 2 * mm),
        Paragraph(f"Class: <b>{_e(class_name)}</b>", s["subtitle"]),
        Spacer(1, 8 * mm),
    ]
    if rows:
        data = [["#", "Date", "Day", "Subject", "Time", "Total", "Pass", "Room"]]
        for i, r in enumerate(rows, start=1):
            d = r.get("exam_date")
            st, et = r.get("start_time"), r.get("end_time")
            time_text = f"{st.strftime('%I:%M %p')} - {et.strftime('%I:%M %p')}" if st and et else (
                st.strftime("%I:%M %p") if st else "—")
            data.append([
                str(i),
                d.strftime("%d %b %Y") if d else "TBA",
                d.strftime("%A") if d else "—",
                Paragraph(_e(r["subject_name"]), s["cell"]),
                time_text,
                _num(r["total_marks"]),
                _num(r["passing_marks"]),
                r.get("room") or "—",
            ])
        t = Table(data, colWidths=[8 * mm, 26 * mm, 22 * mm, 42 * mm, 38 * mm, 14 * mm, 14 * mm, 16 * mm],
                  repeatRows=1)
        t.setStyle(TableStyle(_grid_style(font_size=9)))
        story.append(t)
    else:
        story.append(Paragraph("No papers have been scheduled for this class yet.", s["normal"]))
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph("Students must reach the examination hall 15 minutes before the paper begins.",
                           s["normal"]))
    story.append(Spacer(1, 18 * mm))
    story.append(_signatures(180))
    doc.build(story)
    return buffer.getvalue()


def render_result_card(*, tenant_name: str, exam_name: str, academic_year: str | None, class_name: str,
                       class_strength: int, result: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=16 * mm, bottomMargin=16 * mm,
                            leftMargin=18 * mm, rightMargin=18 * mm)
    s = _styles()
    story = [
        Paragraph(_e(tenant_name), s["title"]),
        Paragraph("Result Card", s["subtitle"]),
        Paragraph(f"{_e(exam_name)}{f' — {_e(academic_year)}' if academic_year else ''}", s["subtitle"]),
        Spacer(1, 8 * mm),
    ]
    class_label = class_name + (f" ({result['section_name']})" if result.get("section_name") else "")
    info = Table(
        [
            ["Student Name", result["full_name"], "Class", class_label],
            ["Roll Number", result.get("roll_number") or "—", "Admission No.", result.get("admission_number") or "—"],
            ["Guardian", result.get("guardian_name") or "—", "Class Strength", str(class_strength)],
        ],
        colWidths=[32 * mm, 56 * mm, 32 * mm, 54 * mm],
    )
    info.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_GREY),
        ("BACKGROUND", (2, 0), (2, -1), LIGHT_GREY),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story += [info, Spacer(1, 8 * mm), Paragraph("Subject-wise Marks", s["heading"]), Spacer(1, 2 * mm)]

    data = [["Subject", "Total", "Passing", "Obtained", "Grade", "Status", "Remarks"]]
    style = _grid_style()
    for i, sub in enumerate(result["subjects"], start=1):
        obtained = "Absent" if sub["is_absent"] else _num(sub["obtained_marks"])
        status = "Pass" if sub["passed"] else ("—" if sub["obtained_marks"] is None and not sub["is_absent"] else "Fail")
        data.append([
            Paragraph(_e(sub["subject_name"]), s["cell"]), _num(sub["total_marks"]), _num(sub["passing_marks"]),
            obtained, sub.get("grade") or "—", status, Paragraph(_e(sub.get("remarks") or ""), s["cell"]),
        ])
        if status == "Fail":
            style.append(("TEXTCOLOR", (3, i), (5, i), FAIL_RED))
    n = len(data)
    data.append(["Total", _num(result["total_marks"]), "", _num(result["total_obtained"]), result.get("grade") or "—",
                 "Pass" if result["passed"] else "Fail", ""])
    style += [("FONTNAME", (0, n), (-1, n), "Helvetica-Bold"), ("BACKGROUND", (0, n), (-1, n), LIGHT_GREY)]
    t = Table(data, colWidths=[44 * mm, 18 * mm, 18 * mm, 20 * mm, 16 * mm, 16 * mm, 42 * mm], repeatRows=1)
    t.setStyle(TableStyle(style))
    story += [t, Spacer(1, 8 * mm)]

    summary = Table(
        [
            ["Percentage", f"{result['percentage']:.2f}%", "Grade", result.get("grade") or "—"],
            ["Position in Class", _ordinal(result.get("position")), "Position in Section",
             _ordinal(result.get("section_position"))],
            ["Result", "PASS" if result["passed"] else "FAIL", "GPA",
             _num(result.get("gpa")) if result.get("gpa") is not None else "—"],
        ],
        colWidths=[38 * mm, 49 * mm, 38 * mm, 49 * mm],
    )
    summary.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10.5),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_GREY),
        ("BACKGROUND", (2, 0), (2, -1), LIGHT_GREY),
        ("TEXTCOLOR", (1, 2), (1, 2), colors.HexColor("#067647") if result["passed"] else FAIL_RED),
        ("FONTNAME", (1, 2), (1, 2), "Helvetica-Bold"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story += [summary, Spacer(1, 6 * mm)]
    remarks = result.get("remarks") or result.get("grade_remarks") or "—"
    story += [Paragraph(f"<b>Remarks:</b> {_e(remarks)}", s["normal"]), Spacer(1, 22 * mm), _signatures(174)]
    doc.build(story)
    return buffer.getvalue()


def render_tabulation(*, tenant_name: str, exam_name: str, academic_year: str | None, class_name: str,
                      section_name: str | None, subjects: list[dict], rows: list[dict]) -> bytes:
    buffer = io.BytesIO()
    page = landscape(A4)
    doc = SimpleDocTemplate(buffer, pagesize=page, topMargin=12 * mm, bottomMargin=12 * mm,
                            leftMargin=10 * mm, rightMargin=10 * mm)
    s = _styles()
    class_label = class_name + (f" — Section {section_name}" if section_name else "")
    story = [
        Paragraph(_e(tenant_name), s["title"]),
        Paragraph(f"Tabulation Sheet — {_e(exam_name)}{f' ({_e(academic_year)})' if academic_year else ''}", s["subtitle"]),
        Paragraph(f"Class: <b>{_e(class_label)}</b>", s["subtitle"]),
        Spacer(1, 6 * mm),
    ]
    header_text_style = ParagraphStyle("TabHead", parent=s["cell"], textColor=colors.white)
    header = ["Pos", "Roll", "Student"] + [
        Paragraph(f"<b>{_e(sub['subject_code'] or sub['subject_name'])}</b><br/>({_num(sub['total_marks'])})",
                  header_text_style)
        for sub in subjects
    ] + ["Total", "%", "Grade", "Result"]
    data = [header]
    style = _grid_style(font_size=8)
    for i, r in enumerate(rows, start=1):
        cells = []
        for j, sub in enumerate(r["subjects"]):
            cells.append("A" if sub["is_absent"] else _num(sub["obtained_marks"]))
            if not sub["passed"] and (sub["is_absent"] or sub["obtained_marks"] is not None):
                style.append(("TEXTCOLOR", (3 + j, i), (3 + j, i), FAIL_RED))
        data.append([
            _num(r.get("position")), r.get("roll_number") or "—", Paragraph(_e(r["full_name"]), s["cell"]), *cells,
            f"{_num(r['total_obtained'])}/{_num(r['total_marks'])}", f"{r['percentage']:.1f}", r.get("grade") or "—",
            "Pass" if r["passed"] else "Fail",
        ])
    usable = page[0] - 20 * mm
    fixed = [10 * mm, 14 * mm, 45 * mm]
    tail = [24 * mm, 13 * mm, 13 * mm, 13 * mm]
    remaining = usable - sum(fixed) - sum(tail)
    sub_w = remaining / max(len(subjects), 1)
    t = Table(data, colWidths=fixed + [sub_w] * len(subjects) + tail, repeatRows=1)
    t.setStyle(TableStyle(style + [("ALIGN", (3, 1), (-1, -1), "CENTER")]))
    story.append(t if rows else Paragraph("No students found for this class.", s["normal"]))
    story += [Spacer(1, 16 * mm), _signatures(270)]
    doc.build(story)
    return buffer.getvalue()
