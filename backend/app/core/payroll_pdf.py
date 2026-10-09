"""Pure PDF renderers for the payroll module (payslip + monthly payroll sheet). Plain data in,
PDF bytes out — same approach as app/core/pdf_render.py."""

import calendar
import io
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.pdf_render import LIGHT_GREY, PRIMARY


def period_label(month: int, year: int) -> str:
    return f"{calendar.month_name[month]} {year}"


def _money(value: float) -> str:
    return f"{float(value):,.2f}"


def _grid_style(header: bool = True) -> TableStyle:
    cmds = [
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    if header:
        cmds += [
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GREY]),
        ]
    return TableStyle(cmds)


def render_payslip(*, tenant_name: str, payslip: dict) -> bytes:
    """payslip: a PayslipOut.model_dump() dict, plus optional bank_name/bank_account_no/department."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, topMargin=16 * mm, bottomMargin=16 * mm, leftMargin=16 * mm, rightMargin=16 * mm
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Title"], textColor=PRIMARY, fontSize=18)
    subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"], alignment=TA_CENTER, fontSize=11)
    net_style = ParagraphStyle("Net", parent=styles["Heading2"], textColor=PRIMARY, alignment=TA_CENTER)
    p = payslip

    story = [
        Paragraph(escape(tenant_name), title_style),
        Paragraph(f"Salary Slip &mdash; {period_label(p['period_month'], p['period_year'])}", subtitle_style),
        Spacer(1, 8 * mm),
    ]

    info = Table(
        [
            ["Employee", p["employee_name"], "Employee Code", p.get("employee_code") or "-"],
            ["Designation", p.get("designation") or "-", "Department", p.get("department") or "-"],
            ["Bank", p.get("bank_name") or "-", "Account No.", p.get("bank_account_no") or "-"],
            ["Days in Month", str(p["working_days"]), "Status", str(p["status"]).title()],
            ["Absent Days", f"{p['absent_days']:g}", "Unpaid Leave Days", f"{p['unpaid_leave_days']:g}"],
        ],
        colWidths=[32 * mm, 57 * mm, 35 * mm, 54 * mm],
    )
    info.setStyle(_grid_style(header=False))
    info.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_GREY),
        ("BACKGROUND", (2, 0), (2, -1), LIGHT_GREY),
    ]))
    story += [info, Spacer(1, 8 * mm)]

    earnings = [["Basic Salary", _money(p["basic_salary"])]]
    earnings += [[a["name"], _money(a["amount"])] for a in p["allowances"]]
    earnings += [[f"Bonus{(' - ' + a['note']) if a.get('note') else ''}", _money(a["amount"])]
                 for a in p["adjustments"] if a["kind"] == "bonus"]

    deductions = [[d["name"], _money(d["amount"])] for d in p["deductions"]]
    if p["absence_deduction"]:
        deductions.append([f"Absence / Unpaid Leave ({p['absent_days'] + p['unpaid_leave_days']:g} d)",
                           _money(p["absence_deduction"])])
    if p["advance_deduction"]:
        deductions.append(["Advance Installment", _money(p["advance_deduction"])])
    deductions += [[f"{a['kind'].title()}{(' - ' + a['note']) if a.get('note') else ''}", _money(a["amount"])]
                   for a in p["adjustments"] if a["kind"] != "bonus"]

    rows = max(len(earnings), len(deductions))
    earnings += [["", ""]] * (rows - len(earnings))
    deductions += [["", ""]] * (rows - len(deductions))
    body = [["Earnings", "Amount", "Deductions", "Amount"]]
    body += [e + d for e, d in zip(earnings, deductions)]
    body.append(["Total Earnings", _money(p["gross_salary"] + p["bonus"]), "Total Deductions",
                 _money(p["total_deductions"])])
    table = Table(body, colWidths=[55 * mm, 34 * mm, 55 * mm, 34 * mm])
    table.setStyle(_grid_style())
    table.setStyle(TableStyle([
        ("ALIGN", (1, 1), (1, -1), "RIGHT"),
        ("ALIGN", (3, 1), (3, -1), "RIGHT"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), LIGHT_GREY),
    ]))
    story += [table, Spacer(1, 8 * mm)]
    story.append(Paragraph(f"Net Pay: {_money(p['net_pay'])}", net_style))
    story.append(Spacer(1, 18 * mm))

    sign = Table([["_______________________", "_______________________"],
                  ["Prepared By", "Authorised Signature"]], colWidths=[89 * mm, 89 * mm])
    sign.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"), ("FONTSIZE", (0, 0), (-1, -1), 9)]))
    story.append(sign)
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("This is a computer-generated salary slip.",
                           ParagraphStyle("Foot", parent=styles["Normal"], fontSize=8, textColor=colors.grey,
                                          alignment=TA_CENTER)))
    doc.build(story)
    return buffer.getvalue()


SHEET_COLUMNS = [
    "#", "Code", "Employee", "Designation", "Basic", "Allowances", "Gross", "Absent", "Absence Ded.",
    "Other Ded.", "Advance", "Bonus", "Fine/Adv.", "Net Pay",
]


def sheet_rows(payslips: list[dict]) -> list[list]:
    rows = []
    for i, p in enumerate(payslips, start=1):
        rows.append([
            i, p.get("employee_code") or "", p["employee_name"], p.get("designation") or "",
            p["basic_salary"], p["total_allowances"], p["gross_salary"],
            p["absent_days"] + p["unpaid_leave_days"], p["absence_deduction"], p["structure_deductions"],
            p["advance_deduction"], p["bonus"], p["adjustment_deduction"], p["net_pay"],
        ])
    return rows


def render_payroll_sheet(*, tenant_name: str, month: int, year: int, status: str, payslips: list[dict]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=landscape(A4), topMargin=12 * mm, bottomMargin=12 * mm, leftMargin=10 * mm,
        rightMargin=10 * mm,
    )
    styles = getSampleStyleSheet()
    story = [
        Paragraph(escape(tenant_name), ParagraphStyle("T", parent=styles["Title"], textColor=PRIMARY, fontSize=16)),
        Paragraph(f"Payroll Sheet &mdash; {period_label(month, year)} ({status.title()})",
                  ParagraphStyle("S", parent=styles["Normal"], alignment=TA_CENTER, fontSize=11)),
        Spacer(1, 6 * mm),
    ]
    data = [SHEET_COLUMNS]
    money_cols = {4, 5, 6, 8, 9, 10, 11, 12, 13}
    for row in sheet_rows(payslips):
        data.append([_money(v) if idx in money_cols else (f"{v:g}" if idx == 7 else str(v))
                     for idx, v in enumerate(row)])
    totals = ["", "", "TOTAL", ""] + [
        _money(sum(float(r[idx]) for r in sheet_rows(payslips))) if idx in money_cols else ""
        for idx in range(4, len(SHEET_COLUMNS))
    ]
    data.append(totals)
    widths = [8, 16, 45, 30, 20, 20, 20, 13, 20, 18, 18, 16, 18, 22]
    table = Table(data, colWidths=[w * mm for w in widths], repeatRows=1)
    table.setStyle(_grid_style())
    table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("ALIGN", (4, 1), (-1, -1), "RIGHT"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), LIGHT_GREY),
    ]))
    story.append(table)
    doc.build(story)
    return buffer.getvalue()
