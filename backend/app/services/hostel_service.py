import uuid
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.hostel import (
    Hostel,
    HostelAllocation,
    HostelFeeRecord,
    HostelMessMenu,
    HostelOutpass,
    HostelRoom,
)
from app.models.user import RoleEnum, User
from app.repositories.fee_repo import InvoiceRepository
from app.repositories.hostel_repo import (
    HostelAllocationRepository,
    HostelFeeRecordRepository,
    HostelMessMenuRepository,
    HostelOutpassRepository,
    HostelRepository,
    HostelRoomRepository,
)
from app.schemas.hostel import (
    HostelAllocationCreate,
    HostelAllocationOut,
    HostelCreate,
    HostelFeeGenerate,
    HostelFeeGenerateResult,
    HostelFeeRecordOut,
    HostelOut,
    HostelUpdate,
    MessMenuOut,
    MessMenuSave,
    MyHostelOut,
    OccupancyRow,
    OutpassCreate,
    OutpassOut,
    RoomCreate,
    RoomOut,
    RoomUpdate,
)
from app.services.transport_hostel_common import (
    MONTH_NAMES,
    assert_can_view_student,
    get_student_or_404,
    issue_other_invoice,
    month_bounds,
    student_names,
    visible_student_ids,
)


def _naive_utc(dt: datetime) -> datetime:
    """SQLite drops tzinfo on read; compare everything as naive UTC."""
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


class HostelService:
    def __init__(self, db: Session):
        self.db = db
        self.hostels = HostelRepository(db)
        self.rooms = HostelRoomRepository(db)
        self.allocations = HostelAllocationRepository(db)
        self.fee_records = HostelFeeRecordRepository(db)
        self.mess = HostelMessMenuRepository(db)
        self.outpasses = HostelOutpassRepository(db)
        self.invoices = InvoiceRepository(db)

    # ------------------------------------------------------------------ hostels
    def _get_hostel(self, tenant_id: uuid.UUID, hostel_id: uuid.UUID) -> Hostel:
        hostel = self.hostels.get_by_id(tenant_id, hostel_id)
        if hostel is None:
            raise NotFoundError("Hostel not found")
        return hostel

    def _hostel_out(self, tenant_id: uuid.UUID, hostel: Hostel, load: dict[uuid.UUID, int]) -> HostelOut:
        rooms = self.rooms.search(tenant_id, hostel.id)
        return HostelOut(
            id=hostel.id,
            name=hostel.name,
            hostel_type=hostel.hostel_type,
            warden_name=hostel.warden_name,
            warden_phone=hostel.warden_phone,
            address=hostel.address,
            status=hostel.status,
            room_count=len(rooms),
            total_beds=sum(r.capacity for r in rooms),
            occupied_beds=sum(load.get(r.id, 0) for r in rooms),
        )

    def create_hostel(self, tenant_id: uuid.UUID, payload: HostelCreate) -> HostelOut:
        hostel = self.hostels.create(Hostel(tenant_id=tenant_id, **payload.model_dump()))
        self.db.commit()
        self.db.refresh(hostel)
        return self._hostel_out(tenant_id, hostel, {})

    def list_hostels(self, tenant_id: uuid.UUID) -> list[HostelOut]:
        load = self.allocations.count_active_by_room(tenant_id)
        return [self._hostel_out(tenant_id, h, load) for h in self.hostels.list_ordered(tenant_id)]

    def get_hostel(self, tenant_id: uuid.UUID, hostel_id: uuid.UUID) -> HostelOut:
        load = self.allocations.count_active_by_room(tenant_id)
        return self._hostel_out(tenant_id, self._get_hostel(tenant_id, hostel_id), load)

    def update_hostel(self, tenant_id: uuid.UUID, hostel_id: uuid.UUID, payload: HostelUpdate) -> HostelOut:
        hostel = self._get_hostel(tenant_id, hostel_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(hostel, field, value)
        self.db.commit()
        self.db.refresh(hostel)
        return self.get_hostel(tenant_id, hostel_id)

    def delete_hostel(self, tenant_id: uuid.UUID, hostel_id: uuid.UUID) -> None:
        self._get_hostel(tenant_id, hostel_id)
        if self.rooms.search(tenant_id, hostel_id):
            raise ConflictError("Hostel has rooms — delete them or mark the hostel inactive")
        for entry in self.mess.list_for_hostel(tenant_id, hostel_id):
            self.db.delete(entry)
        self.hostels.delete(tenant_id, hostel_id)
        self.db.commit()

    # ------------------------------------------------------------------ rooms
    def _get_room(self, tenant_id: uuid.UUID, room_id: uuid.UUID) -> HostelRoom:
        room = self.rooms.get_by_id(tenant_id, room_id)
        if room is None:
            raise NotFoundError("Room not found")
        return room

    def _room_out(self, room: HostelRoom, load: dict[uuid.UUID, int], hostel_name: str | None) -> RoomOut:
        occupied = load.get(room.id, 0)
        return RoomOut(
            id=room.id,
            hostel_id=room.hostel_id,
            hostel_name=hostel_name,
            room_number=room.room_number,
            floor=room.floor,
            room_type=room.room_type,
            capacity=room.capacity,
            monthly_fee=float(room.monthly_fee),
            status=room.status,
            occupied=occupied,
            available=max(0, room.capacity - occupied),
        )

    def _rooms_out(self, tenant_id: uuid.UUID, rooms: list[HostelRoom]) -> list[RoomOut]:
        load = self.allocations.count_active_by_room(tenant_id)
        names = {h.id: h.name for h in self.hostels.list_ordered(tenant_id)}
        return [self._room_out(r, load, names.get(r.hostel_id)) for r in rooms]

    def create_room(self, tenant_id: uuid.UUID, hostel_id: uuid.UUID, payload: RoomCreate) -> RoomOut:
        self._get_hostel(tenant_id, hostel_id)
        if self.rooms.get_by_number(tenant_id, hostel_id, payload.room_number):
            raise ConflictError("A room with this number already exists in the hostel")
        room = self.rooms.create(HostelRoom(tenant_id=tenant_id, hostel_id=hostel_id, **payload.model_dump()))
        self.db.commit()
        self.db.refresh(room)
        return self._rooms_out(tenant_id, [room])[0]

    def list_rooms(self, tenant_id: uuid.UUID, hostel_id: uuid.UUID | None = None) -> list[RoomOut]:
        return self._rooms_out(tenant_id, self.rooms.search(tenant_id, hostel_id))

    def update_room(self, tenant_id: uuid.UUID, room_id: uuid.UUID, payload: RoomUpdate) -> RoomOut:
        room = self._get_room(tenant_id, room_id)
        data = payload.model_dump(exclude_unset=True)
        if data.get("room_number"):
            existing = self.rooms.get_by_number(tenant_id, room.hostel_id, data["room_number"])
            if existing is not None and existing.id != room.id:
                raise ConflictError("A room with this number already exists in the hostel")
        if data.get("capacity") is not None:
            occupied = self.allocations.count_active_by_room(tenant_id).get(room.id, 0)
            if data["capacity"] < occupied:
                raise ConflictError("Capacity cannot be lower than the number of current occupants")
        for field, value in data.items():
            setattr(room, field, value)
        self.db.commit()
        self.db.refresh(room)
        return self._rooms_out(tenant_id, [room])[0]

    def delete_room(self, tenant_id: uuid.UUID, room_id: uuid.UUID) -> None:
        self._get_room(tenant_id, room_id)
        if self.allocations.search(tenant_id, room_id=room_id, status="all"):
            raise ConflictError("Room has allocation history — mark it inactive instead")
        self.rooms.delete(tenant_id, room_id)
        self.db.commit()

    # ------------------------------------------------------------------ allocations
    def _allocations_out(self, tenant_id: uuid.UUID, allocations: list[HostelAllocation]) -> list[HostelAllocationOut]:
        names = student_names(self.db, tenant_id, [a.student_id for a in allocations])
        hostel_names = {h.id: h.name for h in self.hostels.list_ordered(tenant_id)}
        room_cache: dict[uuid.UUID, HostelRoom | None] = {}
        out = []
        for a in allocations:
            if a.room_id not in room_cache:
                room_cache[a.room_id] = self.rooms.get_by_id(tenant_id, a.room_id)
            room = room_cache[a.room_id]
            out.append(
                HostelAllocationOut(
                    id=a.id,
                    student_id=a.student_id,
                    student_name=names.get(a.student_id),
                    hostel_id=a.hostel_id,
                    hostel_name=hostel_names.get(a.hostel_id),
                    room_id=a.room_id,
                    room_number=room.room_number if room else None,
                    bed_label=a.bed_label,
                    from_date=a.from_date,
                    to_date=a.to_date,
                    status=a.status,
                    monthly_fee=float(room.monthly_fee) if room else 0.0,
                    notes=a.notes,
                )
            )
        return out

    def create_allocation(self, tenant_id: uuid.UUID, payload: HostelAllocationCreate) -> HostelAllocationOut:
        get_student_or_404(self.db, tenant_id, payload.student_id)
        room = self._get_room(tenant_id, payload.room_id)
        if room.status != "active":
            raise ConflictError("Room is not available for allocation")
        if self.allocations.active_for_student(tenant_id, payload.student_id) is not None:
            raise ConflictError("Student already has an active hostel allocation — vacate it first")
        if payload.to_date is not None and payload.to_date < payload.from_date:
            raise ConflictError("To date cannot be before from date")
        occupants = self.allocations.search(tenant_id, room_id=room.id, status="active")
        if len(occupants) >= room.capacity:
            raise ConflictError(f"Room {room.room_number} is full ({room.capacity} beds)")
        if payload.bed_label and any(o.bed_label == payload.bed_label for o in occupants):
            raise ConflictError(f"Bed {payload.bed_label} is already taken")
        allocation = self.allocations.create(
            HostelAllocation(tenant_id=tenant_id, hostel_id=room.hostel_id, **payload.model_dump())
        )
        self.db.commit()
        self.db.refresh(allocation)
        return self._allocations_out(tenant_id, [allocation])[0]

    def list_allocations(
        self, tenant_id: uuid.UUID, hostel_id: uuid.UUID | None = None, status: str | None = None
    ) -> list[HostelAllocationOut]:
        return self._allocations_out(tenant_id, self.allocations.search(tenant_id, hostel_id=hostel_id, status=status))

    def vacate(self, tenant_id: uuid.UUID, allocation_id: uuid.UUID, to_date: date | None) -> HostelAllocationOut:
        allocation = self.allocations.get_by_id(tenant_id, allocation_id)
        if allocation is None:
            raise NotFoundError("Allocation not found")
        if allocation.status != "active":
            raise ConflictError("Allocation has already been vacated")
        allocation.to_date = to_date or date.today()
        if allocation.to_date < allocation.from_date:
            raise ConflictError("Vacate date cannot be before the allocation start date")
        allocation.status = "vacated"
        self.db.commit()
        self.db.refresh(allocation)
        return self._allocations_out(tenant_id, [allocation])[0]

    # ------------------------------------------------------------------ fees
    def _fee_records_out(self, tenant_id: uuid.UUID, records: list[HostelFeeRecord]) -> list[HostelFeeRecordOut]:
        names = student_names(self.db, tenant_id, [r.student_id for r in records])
        out = []
        for r in records:
            invoice = self.invoices.get_by_id(tenant_id, r.invoice_id)
            status = None
            if invoice is not None:
                status = invoice.status.value if hasattr(invoice.status, "value") else str(invoice.status)
            out.append(
                HostelFeeRecordOut(
                    id=r.id,
                    student_id=r.student_id,
                    student_name=names.get(r.student_id),
                    allocation_id=r.allocation_id,
                    invoice_id=r.invoice_id,
                    invoice_number=invoice.invoice_number if invoice else None,
                    invoice_status=status,
                    period_month=r.period_month,
                    period_year=r.period_year,
                    amount=float(r.amount),
                )
            )
        return out

    def generate_fees(self, tenant_id: uuid.UUID, payload: HostelFeeGenerate) -> HostelFeeGenerateResult:
        first_day, last_day = month_bounds(payload.period_month, payload.period_year)
        label = f"{MONTH_NAMES[payload.period_month]} {payload.period_year}"
        candidates = [
            a
            for a in self.allocations.search(tenant_id, status="all")
            if a.from_date <= last_day and (a.to_date is None or a.to_date >= first_day)
        ]
        names = student_names(self.db, tenant_id, [a.student_id for a in candidates])
        created: list[HostelFeeRecord] = []
        skipped: list[str] = []
        seen: set[uuid.UUID] = set()
        for allocation in candidates:
            if allocation.student_id in seen:
                continue
            seen.add(allocation.student_id)
            name = names.get(allocation.student_id, str(allocation.student_id))
            if self.fee_records.get_for_period(tenant_id, allocation.student_id, payload.period_month, payload.period_year):
                skipped.append(f"{name}: already billed for {label}")
                continue
            student = get_student_or_404(self.db, tenant_id, allocation.student_id)
            if student.class_grade_id is None:
                skipped.append(f"{name}: not assigned to a class")
                continue
            room = self.rooms.get_by_id(tenant_id, allocation.room_id)
            fee = float(room.monthly_fee) if room else 0.0
            if fee <= 0:
                skipped.append(f"{name}: room has no monthly fee")
                continue
            invoice = issue_other_invoice(self.db, tenant_id, student, fee, payload.due_date, f"Hostel fee {label}")
            created.append(
                self.fee_records.create(
                    HostelFeeRecord(
                        tenant_id=tenant_id,
                        student_id=student.id,
                        allocation_id=allocation.id,
                        invoice_id=invoice.id,
                        period_month=payload.period_month,
                        period_year=payload.period_year,
                        amount=fee,
                    )
                )
            )
        self.db.commit()
        return HostelFeeGenerateResult(
            created_count=len(created),
            skipped_count=len(skipped),
            skipped=skipped,
            records=self._fee_records_out(tenant_id, created),
        )

    def list_fee_records(self, tenant_id: uuid.UUID, month: int | None, year: int | None) -> list[HostelFeeRecordOut]:
        return self._fee_records_out(tenant_id, self.fee_records.search(tenant_id, month, year))

    # ------------------------------------------------------------------ mess menu
    def get_mess_menu(self, tenant_id: uuid.UUID, hostel_id: uuid.UUID | None) -> list[HostelMessMenu]:
        if hostel_id is not None:
            self._get_hostel(tenant_id, hostel_id)
        return self.mess.list_for_hostel(tenant_id, hostel_id)

    def effective_mess_menu(self, tenant_id: uuid.UUID, hostel_id: uuid.UUID | None) -> list[HostelMessMenu]:
        """Hostel-specific menu when one exists, otherwise the school-wide menu."""
        if hostel_id is not None:
            specific = self.mess.list_for_hostel(tenant_id, hostel_id)
            if specific:
                return specific
        return self.mess.list_for_hostel(tenant_id, None)

    def save_mess_menu(self, tenant_id: uuid.UUID, payload: MessMenuSave) -> list[HostelMessMenu]:
        if payload.hostel_id is not None:
            self._get_hostel(tenant_id, payload.hostel_id)
        existing = {m.day_of_week: m for m in self.mess.list_for_hostel(tenant_id, payload.hostel_id)}
        for entry in payload.entries:
            row = existing.get(entry.day_of_week)
            if row is None:
                row = self.mess.create(
                    HostelMessMenu(tenant_id=tenant_id, hostel_id=payload.hostel_id, day_of_week=entry.day_of_week)
                )
                existing[entry.day_of_week] = row
            row.breakfast = entry.breakfast
            row.lunch = entry.lunch
            row.dinner = entry.dinner
        self.db.commit()
        return self.mess.list_for_hostel(tenant_id, payload.hostel_id)

    # ------------------------------------------------------------------ outpasses
    def _outpasses_out(self, tenant_id: uuid.UUID, passes: list[HostelOutpass]) -> list[OutpassOut]:
        names = student_names(self.db, tenant_id, [p.student_id for p in passes])
        hostel_names = {h.id: h.name for h in self.hostels.list_ordered(tenant_id)}
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        out = []
        for p in passes:
            expected = _naive_utc(p.expected_return_at)
            if p.actual_return_at is not None:
                late = _naive_utc(p.actual_return_at) > expected
            else:
                late = p.status == "approved" and now > expected
            out.append(
                OutpassOut(
                    id=p.id,
                    student_id=p.student_id,
                    student_name=names.get(p.student_id),
                    hostel_id=p.hostel_id,
                    hostel_name=hostel_names.get(p.hostel_id) if p.hostel_id else None,
                    out_at=p.out_at,
                    expected_return_at=p.expected_return_at,
                    actual_return_at=p.actual_return_at,
                    reason=p.reason,
                    visitor_name=p.visitor_name,
                    visitor_relation=p.visitor_relation,
                    status=p.status,
                    approved_by_name=p.approved_by_name,
                    remarks=p.remarks,
                    is_late=late,
                )
            )
        return out

    def create_outpass(self, user: User, payload: OutpassCreate) -> OutpassOut:
        tenant_id = user.tenant_id
        if user.role == RoleEnum.ADMIN:
            get_student_or_404(self.db, tenant_id, payload.student_id)
        elif payload.student_id not in visible_student_ids(self.db, user):
            raise ForbiddenError("You may only request an outpass for your own child")
        if _naive_utc(payload.expected_return_at) <= _naive_utc(payload.out_at):
            raise ConflictError("Expected return must be after the out time")
        allocation = self.allocations.active_for_student(tenant_id, payload.student_id)
        if allocation is None:
            raise ConflictError("Student is not currently allocated to a hostel")
        is_admin = user.role == RoleEnum.ADMIN
        outpass = self.outpasses.create(
            HostelOutpass(
                tenant_id=tenant_id,
                hostel_id=allocation.hostel_id,
                requested_by_user_id=user.id,
                status="approved" if is_admin else "pending",
                approved_by_user_id=user.id if is_admin else None,
                approved_by_name=user.full_name if is_admin else None,
                **payload.model_dump(),
            )
        )
        self.db.commit()
        self.db.refresh(outpass)
        return self._outpasses_out(tenant_id, [outpass])[0]

    def list_outpasses(self, user: User, status: str | None = None) -> list[OutpassOut]:
        student_ids = None if user.role == RoleEnum.ADMIN else visible_student_ids(self.db, user)
        return self._outpasses_out(user.tenant_id, self.outpasses.search(user.tenant_id, status, student_ids))

    def _get_outpass(self, tenant_id: uuid.UUID, outpass_id: uuid.UUID) -> HostelOutpass:
        outpass = self.outpasses.get_by_id(tenant_id, outpass_id)
        if outpass is None:
            raise NotFoundError("Outpass not found")
        return outpass

    def decide_outpass(self, user: User, outpass_id: uuid.UUID, approve: bool, remarks: str | None) -> OutpassOut:
        outpass = self._get_outpass(user.tenant_id, outpass_id)
        if outpass.status != "pending":
            raise ConflictError("Only pending outpasses can be approved or rejected")
        outpass.status = "approved" if approve else "rejected"
        outpass.approved_by_user_id = user.id
        outpass.approved_by_name = user.full_name
        if remarks is not None:
            outpass.remarks = remarks
        self.db.commit()
        self.db.refresh(outpass)
        return self._outpasses_out(user.tenant_id, [outpass])[0]

    def mark_returned(self, tenant_id: uuid.UUID, outpass_id: uuid.UUID, returned_at: datetime | None) -> OutpassOut:
        outpass = self._get_outpass(tenant_id, outpass_id)
        if outpass.status != "approved":
            raise ConflictError("Only approved outpasses can be marked as returned")
        outpass.actual_return_at = returned_at or datetime.now(timezone.utc)
        outpass.status = "returned"
        self.db.commit()
        self.db.refresh(outpass)
        return self._outpasses_out(tenant_id, [outpass])[0]

    # ------------------------------------------------------------------ reports
    def occupancy(self, tenant_id: uuid.UUID) -> list[OccupancyRow]:
        load = self.allocations.count_active_by_room(tenant_id)
        rows = []
        for hostel in self.hostels.list_ordered(tenant_id):
            rooms = [self._room_out(r, load, hostel.name) for r in self.rooms.search(tenant_id, hostel.id)]
            total = sum(r.capacity for r in rooms)
            occupied = sum(r.occupied for r in rooms)
            rows.append(
                OccupancyRow(
                    hostel_id=hostel.id,
                    hostel_name=hostel.name,
                    hostel_type=hostel.hostel_type,
                    room_count=len(rooms),
                    total_beds=total,
                    occupied_beds=occupied,
                    available_beds=max(0, total - occupied),
                    occupancy_percent=round(occupied * 100 / total, 1) if total else 0.0,
                    rooms=rooms,
                )
            )
        return rows

    # ------------------------------------------------------------------ portal
    def _my_hostel_for(self, tenant_id: uuid.UUID, student_id: uuid.UUID, name: str | None) -> MyHostelOut:
        outpasses = self._outpasses_out(tenant_id, self.outpasses.search(tenant_id, None, [student_id])[:10])
        allocation = self.allocations.active_for_student(tenant_id, student_id)
        if allocation is None:
            return MyHostelOut(student_id=student_id, student_name=name, outpasses=outpasses)
        hostel = self.hostels.get_by_id(tenant_id, allocation.hostel_id)
        room = self.rooms.get_by_id(tenant_id, allocation.room_id)
        menu = [MessMenuOut.model_validate(m) for m in self.effective_mess_menu(tenant_id, allocation.hostel_id)]
        return MyHostelOut(
            student_id=student_id,
            student_name=name,
            allocation_id=allocation.id,
            hostel_name=hostel.name if hostel else None,
            hostel_type=hostel.hostel_type if hostel else None,
            warden_name=hostel.warden_name if hostel else None,
            warden_phone=hostel.warden_phone if hostel else None,
            room_number=room.room_number if room else None,
            floor=room.floor if room else None,
            room_type=room.room_type if room else None,
            bed_label=allocation.bed_label,
            from_date=allocation.from_date,
            monthly_fee=float(room.monthly_fee) if room else None,
            mess_menu=menu,
            outpasses=outpasses,
        )

    def my_hostel(self, user: User) -> list[MyHostelOut]:
        ids = visible_student_ids(self.db, user)
        names = student_names(self.db, user.tenant_id, ids)
        return [self._my_hostel_for(user.tenant_id, sid, names.get(sid)) for sid in ids]

    def student_hostel(self, user: User, student_id: uuid.UUID) -> MyHostelOut:
        assert_can_view_student(self.db, user, student_id)
        names = student_names(self.db, user.tenant_id, [student_id])
        return self._my_hostel_for(user.tenant_id, student_id, names.get(student_id))
