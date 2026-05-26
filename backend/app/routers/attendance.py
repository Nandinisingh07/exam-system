from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AttendanceRecord, Student, Exam, User
from ..utils.auth import get_current_user, require_admin
import pandas as pd
import io

router = APIRouter(prefix="/api/attendance", tags=["attendance"])

def _build_records(db, exam_id=None, invigilator_id=None):
    from ..models.logistics import SeatAllocation
    q = db.query(AttendanceRecord)
    if exam_id:
        q = q.filter(AttendanceRecord.exam_id == exam_id)
    if invigilator_id:
        q = q.filter(AttendanceRecord.marked_by == invigilator_id)
    records = q.order_by(AttendanceRecord.marked_at.desc()).all()
    result = []
    for r in records:
        student  = r.student
        exam     = r.exam
        invig    = r.invigilator
        allocation = None
        if student and exam:
            allocation = db.query(SeatAllocation).filter(
                SeatAllocation.student_id == student.id,
                SeatAllocation.exam_id    == exam.id
            ).first()
        result.append({
            "id":          r.id,
            "seat":        allocation.seat_number if allocation else "-",
            "name":        student.name if student else "Unknown",
            "enrollment":  student.enrollment_no if student else "N/A",
            "invigilator": invig.name if invig else "System",
            "exam":        exam.subject_name if exam else "Unknown Exam",
            "code":        exam.subject_code if exam else "",
            "room":        allocation.classroom.room_number if (allocation and allocation.classroom) else "-",
            "time":        r.marked_at.strftime("%H:%M") if r.marked_at else "-",
            "date":        r.marked_at.strftime("%d/%m/%Y") if r.marked_at else "-",
            "method":      f"{'Face+' if r.face_verified else ''}{'ID+' if r.id_verified else ''}OCR",
            "status":      r.status,
            "invigilator_id": r.marked_by,
        })
    return result


@router.get("")
def get_all_attendance(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return _build_records(db)


@router.get("/my")
def get_my_attendance(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Invigilator sees only attendance they marked."""
    return _build_records(db, invigilator_id=user.id)


@router.get("/exam/{exam_id}")
def get_attendance(exam_id: int, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.exam_id == exam_id
    ).order_by(AttendanceRecord.marked_at.desc()).all()
    result = []
    for r in records:
        student = r.student
        result.append({
            "id":            r.id,
            "student_name":  student.name if student else "Unknown",
            "enrollment_no": student.enrollment_no if student else "N/A",
            "face_verified": r.face_verified,
            "admit_verified":r.admit_verified,
            "status":        r.status,
            "marked_at":     str(r.marked_at)
        })
    return {"total": len(result), "records": result}


def _make_dataframe(records):
    data = []
    for r in records:
        data.append({
            "Sr No":         len(data) + 1,
            "Student Name":  r["name"],
            "Enrollment No": r["enrollment"],
            "Seat No":       r["seat"],
            "Room":          r["room"],
            "Exam":          r["exam"],
            "Subject Code":  r["code"],
            "Date":          r["date"],
            "Time":          r["time"],
            "Invigilator":   r["invigilator"],
            "Verification":  r["method"],
            "Status":        r["status"],
        })
    return pd.DataFrame(data)


@router.get("/export/{exam_id}")
def export_attendance(
    exam_id: int,
    fmt: str = Query("csv", enum=["csv", "pdf", "excel"]),
    db:  Session = Depends(get_db),
    user: User   = Depends(get_current_user),
):
    exam    = db.query(Exam).filter(Exam.id == exam_id).first()
    records = _build_records(db, exam_id=exam_id)
    df      = _make_dataframe(records)
    fname   = f"attendance_{exam.subject_code if exam else exam_id}"

    if fmt == "excel":
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Attendance")
        buf.seek(0)
        return StreamingResponse(buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={fname}.xlsx"})

    if fmt == "pdf":
        try:
            from reportlab.lib.pagesizes import A4, landscape
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
            from reportlab.lib import colors
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.lib.units import cm

            buf = io.BytesIO()
            doc = SimpleDocTemplate(buf, pagesize=landscape(A4),
                                    leftMargin=1*cm, rightMargin=1*cm,
                                    topMargin=1.5*cm, bottomMargin=1.5*cm)
            styles = getSampleStyleSheet()
            elems  = []

            title = exam.subject_name if exam else "Exam"
            code  = exam.subject_code if exam else ""
            elems.append(Paragraph(f"<b>Attendance Sheet — {title} ({code})</b>", styles["Title"]))
            elems.append(Spacer(1, 0.3*cm))
            elems.append(Paragraph(f"Total Present: {len(records)}", styles["Normal"]))
            elems.append(Spacer(1, 0.5*cm))

            cols   = ["Sr No","Student Name","Enrollment No","Seat","Room","Date","Time","Invigilator","Status"]
            header = [cols]
            rows   = []
            for r in records:
                rows.append([
                    str(len(rows)+1), r["name"], r["enrollment"],
                    r["seat"], r["room"], r["date"], r["time"],
                    r["invigilator"], r["status"]
                ])

            table_data = header + rows
            t = Table(table_data, repeatRows=1)
            t.setStyle(TableStyle([
                ("BACKGROUND",  (0,0), (-1,0),  colors.HexColor("#4F46E5")),
                ("TEXTCOLOR",   (0,0), (-1,0),  colors.white),
                ("FONTNAME",    (0,0), (-1,0),  "Helvetica-Bold"),
                ("FONTSIZE",    (0,0), (-1,-1), 8),
                ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white, colors.HexColor("#F5F5FF")]),
                ("GRID",        (0,0), (-1,-1), 0.4, colors.HexColor("#D1D5DB")),
                ("ALIGN",       (0,0), (-1,-1), "CENTER"),
                ("ALIGN",       (1,1), (1,-1),  "LEFT"),
                ("ALIGN",       (2,1), (2,-1),  "LEFT"),
                ("PADDING",     (0,0), (-1,-1), 5),
            ]))
            elems.append(t)
            doc.build(elems)
            buf.seek(0)
            return StreamingResponse(buf, media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={fname}.pdf"})

        except ImportError:
            return StreamingResponse(
                io.BytesIO(b"PDF export requires reportlab. Run: pip install reportlab --break-system-packages"),
                media_type="text/plain")

    # default CSV
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={fname}.csv"})


@router.get("/export-all")
def export_all(
    fmt: str = Query("csv", enum=["csv","excel","pdf"]),
    db:  Session = Depends(get_db),
    user: User   = Depends(get_current_user),
):
    if user.role == "admin":
        records = _build_records(db)
    else:
        records = _build_records(db, invigilator_id=user.id)
    df = _make_dataframe(records)

    if fmt == "excel":
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="All Attendance")
        buf.seek(0)
        return StreamingResponse(buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=all_attendance.xlsx"})

    if fmt == "pdf":
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import cm
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=landscape(A4),
                                leftMargin=1*cm, rightMargin=1*cm,
                                topMargin=1.5*cm, bottomMargin=1.5*cm)
        styles = getSampleStyleSheet()
        elems  = []
        elems.append(Paragraph("<b>Full Attendance Report</b>", styles["Title"]))
        elems.append(Spacer(1, 0.3*cm))
        elems.append(Paragraph(f"Total Records: {len(records)}", styles["Normal"]))
        elems.append(Spacer(1, 0.5*cm))
        cols = ["Sr No","Student Name","Enrollment No","Seat","Room","Exam","Date","Time","Invigilator","Status"]
        rows = [[str(i+1), r["name"], r["enrollment"], r["seat"], r["room"],
                 r["exam"], r["date"], r["time"], r["invigilator"], r["status"]]
                for i, r in enumerate(records)]
        t = Table([cols] + rows, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND",  (0,0), (-1,0),  colors.HexColor("#4F46E5")),
            ("TEXTCOLOR",   (0,0), (-1,0),  colors.white),
            ("FONTNAME",    (0,0), (-1,0),  "Helvetica-Bold"),
            ("FONTSIZE",    (0,0), (-1,-1), 7),
            ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white, colors.HexColor("#F5F5FF")]),
            ("GRID",        (0,0), (-1,-1), 0.4, colors.HexColor("#D1D5DB")),
            ("ALIGN",       (0,0), (-1,-1), "CENTER"),
            ("PADDING",     (0,0), (-1,-1), 4),
        ]))
        elems.append(t)
        doc.build(elems)
        buf.seek(0)
        return StreamingResponse(buf, media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=all_attendance.pdf"})

    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=all_attendance.csv"})

@router.get("/export-invigilator/{invigilator_id}")
def export_invigilator_attendance(
    invigilator_id: int,
    fmt: str = Query("pdf", enum=["csv","excel","pdf"]),
    db:  Session = Depends(get_db),
    _:   User    = Depends(require_admin),
):
    from ..models import User as UserModel
    invig   = db.query(UserModel).filter(UserModel.id == invigilator_id).first()
    records = _build_records(db, invigilator_id=invigilator_id)
    df      = _make_dataframe(records)
    invig_name = invig.name if invig else f"Invigilator_{invigilator_id}"

    # Group by exam+room for the cover line
    rooms = list({f"{r['room']}" for r in records})
    exams = list({f"{r['exam']}" for r in records})
    room_str = ", ".join(rooms) if rooms else "-"
    exam_str = ", ".join(exams) if exams else "-"

    if fmt == "excel":
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Attendance")
        buf.seek(0)
        return StreamingResponse(buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=attendance_{invig_name}.xlsx"})

    if fmt == "pdf":
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import cm
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=landscape(A4),
                                leftMargin=1*cm, rightMargin=1*cm,
                                topMargin=1.5*cm, bottomMargin=1.5*cm)
        styles = getSampleStyleSheet()
        elems  = []
        elems.append(Paragraph(f"<b>Attendance Sheet</b>", styles["Title"]))
        elems.append(Spacer(1, 0.2*cm))
        elems.append(Paragraph(f"<b>Invigilator:</b> {invig_name}", styles["Normal"]))
        elems.append(Paragraph(f"<b>Room:</b> {room_str} &nbsp;&nbsp; <b>Exam:</b> {exam_str}", styles["Normal"]))
        elems.append(Paragraph(f"<b>Total Present:</b> {len(records)}", styles["Normal"]))
        elems.append(Spacer(1, 0.5*cm))
        cols = ["Sr No","Student Name","Enrollment No","Seat","Room","Exam","Date","Time","Verification","Status"]
        rows = [[str(i+1), r["name"], r["enrollment"], r["seat"], r["room"],
                 r["exam"], r["date"], r["time"], r["method"], r["status"]]
                for i, r in enumerate(records)]
        t = Table([cols] + rows, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,0),  colors.HexColor("#4F46E5")),
            ("TEXTCOLOR",     (0,0), (-1,0),  colors.white),
            ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0,0), (-1,-1), 8),
            ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.white, colors.HexColor("#F0F0FF")]),
            ("GRID",          (0,0), (-1,-1), 0.4, colors.HexColor("#D1D5DB")),
            ("ALIGN",         (0,0), (-1,-1), "CENTER"),
            ("ALIGN",         (1,1), (2,-1),  "LEFT"),
            ("PADDING",       (0,0), (-1,-1), 5),
        ]))
        elems.append(t)
        doc.build(elems)
        buf.seek(0)
        return StreamingResponse(buf, media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=attendance_{invig_name}.pdf"})

    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=attendance_{invig_name}.csv"})
