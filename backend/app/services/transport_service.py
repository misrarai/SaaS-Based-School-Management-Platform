import uuid
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models.transport import (
    TransportAllocation,
    TransportDriver,
    TransportFeeRecord,
    TransportRoute,
    TransportStop,
    TransportVehicle,
)
from app.models.user import User
from app.repositories.fee_repo import InvoiceRepository
from app.repositories.staff_repo import StaffRepository
from app.repositories.transport_repo import (
    TransportAllocationRepository,
    TransportDriverRepository,
    TransportFeeRecordRepository,
    TransportRouteRepository,
    TransportStopRepository,
    TransportVehicleRepository,
)
from app.schemas.transport import (
    AllocationCreate,
    AllocationOut,
    AllocationUpdate,
    DriverCreate,
    DriverUpdate,
    ExpiringDocumentRow,
    MyTransportOut,
    RouteCreate,
    RouteOut,
    RouteStrengthRow,
    RouteUpdate,
    StopCreate,
    StopOut,
    StopUpdate,
    TransportFeeGenerate,
    TransportFeeGenerateResult,
    TransportFeeRecordOut,
    VehicleCreate,
    VehicleOut,
    VehicleUpdate,
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


class TransportService:
    def __init__(self, db: Session):
        self.db = db
        self.drivers = TransportDriverRepository(db)
        self.vehicles = TransportVehicleRepository(db)
        self.routes = TransportRouteRepository(db)
        self.stops = TransportStopRepository(db)
        self.allocations = TransportAllocationRepository(db)
        self.fee_records = TransportFeeRecordRepository(db)
        self.invoices = InvoiceRepository(db)
        self.staff = StaffRepository(db)

    # ------------------------------------------------------------------ drivers
    def _get_driver(self, tenant_id: uuid.UUID, driver_id: uuid.UUID) -> TransportDriver:
        driver = self.drivers.get_by_id(tenant_id, driver_id)
        if driver is None:
            raise NotFoundError("Driver not found")
        return driver

    def _check_staff(self, tenant_id: uuid.UUID, staff_id: uuid.UUID | None) -> None:
        if staff_id is not None and self.staff.get_by_id(tenant_id, staff_id) is None:
            raise NotFoundError("Staff member not found")

    def create_driver(self, tenant_id: uuid.UUID, payload: DriverCreate) -> TransportDriver:
        self._check_staff(tenant_id, payload.staff_id)
        driver = self.drivers.create(TransportDriver(tenant_id=tenant_id, **payload.model_dump()))
        self.db.commit()
        self.db.refresh(driver)
        return driver

    def list_drivers(self, tenant_id: uuid.UUID) -> list[TransportDriver]:
        return self.drivers.list_ordered(tenant_id)

    def get_driver(self, tenant_id: uuid.UUID, driver_id: uuid.UUID) -> TransportDriver:
        return self._get_driver(tenant_id, driver_id)

    def update_driver(self, tenant_id: uuid.UUID, driver_id: uuid.UUID, payload: DriverUpdate) -> TransportDriver:
        driver = self._get_driver(tenant_id, driver_id)
        data = payload.model_dump(exclude_unset=True)
        if "staff_id" in data:
            self._check_staff(tenant_id, data["staff_id"])
        for field, value in data.items():
            setattr(driver, field, value)
        self.db.commit()
        self.db.refresh(driver)
        return driver

    def delete_driver(self, tenant_id: uuid.UUID, driver_id: uuid.UUID) -> None:
        self._get_driver(tenant_id, driver_id)
        if self.vehicles.count_for_driver(tenant_id, driver_id):
            raise ConflictError("Driver is assigned to a vehicle — unassign before deleting")
        self.drivers.delete(tenant_id, driver_id)
        self.db.commit()

    # ------------------------------------------------------------------ vehicles
    def _get_vehicle(self, tenant_id: uuid.UUID, vehicle_id: uuid.UUID) -> TransportVehicle:
        vehicle = self.vehicles.get_by_id(tenant_id, vehicle_id)
        if vehicle is None:
            raise NotFoundError("Vehicle not found")
        return vehicle

    def _vehicle_load(self, tenant_id: uuid.UUID, vehicle_id: uuid.UUID) -> int:
        route_ids = [r.id for r in self.routes.list_for_vehicle(tenant_id, vehicle_id)]
        return self.allocations.count_active_for_routes(tenant_id, route_ids)

    def _vehicle_out(self, tenant_id: uuid.UUID, v: TransportVehicle) -> VehicleOut:
        driver = self.drivers.get_by_id(tenant_id, v.driver_id) if v.driver_id else None
        return VehicleOut(
            id=v.id,
            registration_number=v.registration_number,
            vehicle_type=v.vehicle_type,
            capacity=v.capacity,
            model=v.model,
            insurance_expiry=v.insurance_expiry,
            fitness_expiry=v.fitness_expiry,
            driver_id=v.driver_id,
            driver_name=driver.full_name if driver else None,
            driver_phone=driver.phone if driver else None,
            conductor_name=v.conductor_name,
            conductor_phone=v.conductor_phone,
            status=v.status,
            allocated_count=self._vehicle_load(tenant_id, v.id),
        )

    def create_vehicle(self, tenant_id: uuid.UUID, payload: VehicleCreate) -> VehicleOut:
        if self.vehicles.get_by_registration(tenant_id, payload.registration_number):
            raise ConflictError("A vehicle with this registration number already exists")
        if payload.driver_id is not None:
            self._get_driver(tenant_id, payload.driver_id)
        vehicle = self.vehicles.create(TransportVehicle(tenant_id=tenant_id, **payload.model_dump()))
        self.db.commit()
        self.db.refresh(vehicle)
        return self._vehicle_out(tenant_id, vehicle)

    def list_vehicles(self, tenant_id: uuid.UUID) -> list[VehicleOut]:
        return [self._vehicle_out(tenant_id, v) for v in self.vehicles.list_ordered(tenant_id)]

    def get_vehicle(self, tenant_id: uuid.UUID, vehicle_id: uuid.UUID) -> VehicleOut:
        return self._vehicle_out(tenant_id, self._get_vehicle(tenant_id, vehicle_id))

    def update_vehicle(self, tenant_id: uuid.UUID, vehicle_id: uuid.UUID, payload: VehicleUpdate) -> VehicleOut:
        vehicle = self._get_vehicle(tenant_id, vehicle_id)
        data = payload.model_dump(exclude_unset=True)
        if data.get("registration_number"):
            existing = self.vehicles.get_by_registration(tenant_id, data["registration_number"])
            if existing is not None and existing.id != vehicle.id:
                raise ConflictError("A vehicle with this registration number already exists")
        if data.get("driver_id") is not None:
            self._get_driver(tenant_id, data["driver_id"])
        if data.get("capacity") is not None and data["capacity"] < self._vehicle_load(tenant_id, vehicle.id):
            raise ConflictError("Capacity cannot be lower than the number of students already allocated")
        for field, value in data.items():
            setattr(vehicle, field, value)
        self.db.commit()
        self.db.refresh(vehicle)
        return self._vehicle_out(tenant_id, vehicle)

    def delete_vehicle(self, tenant_id: uuid.UUID, vehicle_id: uuid.UUID) -> None:
        self._get_vehicle(tenant_id, vehicle_id)
        if self.routes.list_for_vehicle(tenant_id, vehicle_id):
            raise ConflictError("Vehicle is assigned to a route — reassign the route before deleting")
        self.vehicles.delete(tenant_id, vehicle_id)
        self.db.commit()

    # ------------------------------------------------------------------ routes & stops
    def _get_route(self, tenant_id: uuid.UUID, route_id: uuid.UUID) -> TransportRoute:
        route = self.routes.get_by_id(tenant_id, route_id)
        if route is None:
            raise NotFoundError("Route not found")
        return route

    def _get_stop(self, tenant_id: uuid.UUID, stop_id: uuid.UUID) -> TransportStop:
        stop = self.stops.get_by_id(tenant_id, stop_id)
        if stop is None:
            raise NotFoundError("Stop not found")
        return stop

    def _route_out(self, tenant_id: uuid.UUID, route: TransportRoute) -> RouteOut:
        vehicle = self.vehicles.get_by_id(tenant_id, route.vehicle_id) if route.vehicle_id else None
        stops = self.stops.list_for_routes(tenant_id, [route.id])
        return RouteOut(
            id=route.id,
            name=route.name,
            code=route.code,
            vehicle_id=route.vehicle_id,
            vehicle_registration=vehicle.registration_number if vehicle else None,
            vehicle_capacity=vehicle.capacity if vehicle else None,
            start_point=route.start_point,
            description=route.description,
            status=route.status,
            stops=[StopOut.model_validate(s) for s in stops],
            allocated_count=self.allocations.count_active_for_routes(tenant_id, [route.id]),
        )

    def create_route(self, tenant_id: uuid.UUID, payload: RouteCreate) -> RouteOut:
        if payload.vehicle_id is not None:
            self._get_vehicle(tenant_id, payload.vehicle_id)
        route = self.routes.create(
            TransportRoute(
                tenant_id=tenant_id,
                name=payload.name,
                code=payload.code,
                vehicle_id=payload.vehicle_id,
                start_point=payload.start_point,
                description=payload.description,
            )
        )
        for stop in payload.stops:
            self.stops.create(TransportStop(tenant_id=tenant_id, route_id=route.id, **stop.model_dump()))
        self.db.commit()
        self.db.refresh(route)
        return self._route_out(tenant_id, route)

    def list_routes(self, tenant_id: uuid.UUID) -> list[RouteOut]:
        return [self._route_out(tenant_id, r) for r in self.routes.list_ordered(tenant_id)]

    def get_route(self, tenant_id: uuid.UUID, route_id: uuid.UUID) -> RouteOut:
        return self._route_out(tenant_id, self._get_route(tenant_id, route_id))

    def update_route(self, tenant_id: uuid.UUID, route_id: uuid.UUID, payload: RouteUpdate) -> RouteOut:
        route = self._get_route(tenant_id, route_id)
        data = payload.model_dump(exclude_unset=True)
        if data.get("vehicle_id") is not None and data["vehicle_id"] != route.vehicle_id:
            vehicle = self._get_vehicle(tenant_id, data["vehicle_id"])
            incoming = self.allocations.count_active_for_routes(tenant_id, [route.id])
            if self._vehicle_load(tenant_id, vehicle.id) + incoming > vehicle.capacity:
                raise ConflictError("The selected vehicle does not have enough free seats for this route")
        for field, value in data.items():
            setattr(route, field, value)
        self.db.commit()
        self.db.refresh(route)
        return self._route_out(tenant_id, route)

    def delete_route(self, tenant_id: uuid.UUID, route_id: uuid.UUID) -> None:
        self._get_route(tenant_id, route_id)
        if self.allocations.search(tenant_id, route_id=route_id, status="all"):
            raise ConflictError("Route has student allocations — mark it inactive instead")
        for stop in self.stops.list_for_routes(tenant_id, [route_id]):
            self.db.delete(stop)
        self.routes.delete(tenant_id, route_id)
        self.db.commit()

    def add_stop(self, tenant_id: uuid.UUID, route_id: uuid.UUID, payload: StopCreate) -> TransportStop:
        self._get_route(tenant_id, route_id)
        stop = self.stops.create(TransportStop(tenant_id=tenant_id, route_id=route_id, **payload.model_dump()))
        self.db.commit()
        self.db.refresh(stop)
        return stop

    def update_stop(self, tenant_id: uuid.UUID, stop_id: uuid.UUID, payload: StopUpdate) -> TransportStop:
        stop = self._get_stop(tenant_id, stop_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(stop, field, value)
        self.db.commit()
        self.db.refresh(stop)
        return stop

    def delete_stop(self, tenant_id: uuid.UUID, stop_id: uuid.UUID) -> None:
        self._get_stop(tenant_id, stop_id)
        if self.allocations.search(tenant_id, stop_id=stop_id, status="all"):
            raise ConflictError("Stop has student allocations and cannot be deleted")
        self.stops.delete(tenant_id, stop_id)
        self.db.commit()

    # ------------------------------------------------------------------ allocations
    def _allocations_out(self, tenant_id: uuid.UUID, allocations: list[TransportAllocation]) -> list[AllocationOut]:
        names = student_names(self.db, tenant_id, [a.student_id for a in allocations])
        route_cache: dict[uuid.UUID, TransportRoute | None] = {}
        stop_cache: dict[uuid.UUID, TransportStop | None] = {}
        out: list[AllocationOut] = []
        for a in allocations:
            if a.route_id not in route_cache:
                route_cache[a.route_id] = self.routes.get_by_id(tenant_id, a.route_id)
            if a.stop_id not in stop_cache:
                stop_cache[a.stop_id] = self.stops.get_by_id(tenant_id, a.stop_id)
            route, stop = route_cache[a.route_id], stop_cache[a.stop_id]
            out.append(
                AllocationOut(
                    id=a.id,
                    student_id=a.student_id,
                    student_name=names.get(a.student_id),
                    route_id=a.route_id,
                    route_name=route.name if route else None,
                    stop_id=a.stop_id,
                    stop_name=stop.name if stop else None,
                    pickup_type=a.pickup_type,
                    start_date=a.start_date,
                    end_date=a.end_date,
                    status=a.status,
                    monthly_fare=float(stop.monthly_fare) if stop else 0.0,
                    notes=a.notes,
                )
            )
        return out

    def _check_route_stop_capacity(
        self, tenant_id: uuid.UUID, route_id: uuid.UUID, stop_id: uuid.UUID, moving_in: bool
    ) -> None:
        route = self._get_route(tenant_id, route_id)
        stop = self._get_stop(tenant_id, stop_id)
        if stop.route_id != route.id:
            raise ConflictError("Stop does not belong to the selected route")
        if moving_in and route.vehicle_id is not None:
            vehicle = self._get_vehicle(tenant_id, route.vehicle_id)
            if self._vehicle_load(tenant_id, vehicle.id) >= vehicle.capacity:
                raise ConflictError(
                    f"Vehicle {vehicle.registration_number} is full ({vehicle.capacity} seats)"
                )

    def create_allocation(self, tenant_id: uuid.UUID, payload: AllocationCreate) -> AllocationOut:
        get_student_or_404(self.db, tenant_id, payload.student_id)
        if self.allocations.active_for_student(tenant_id, payload.student_id) is not None:
            raise ConflictError("Student already has an active transport allocation")
        if payload.end_date is not None and payload.end_date < payload.start_date:
            raise ConflictError("End date cannot be before start date")
        self._check_route_stop_capacity(tenant_id, payload.route_id, payload.stop_id, moving_in=True)
        allocation = self.allocations.create(TransportAllocation(tenant_id=tenant_id, **payload.model_dump()))
        self.db.commit()
        self.db.refresh(allocation)
        return self._allocations_out(tenant_id, [allocation])[0]

    def list_allocations(
        self, tenant_id: uuid.UUID, route_id: uuid.UUID | None = None, status: str | None = None
    ) -> list[AllocationOut]:
        return self._allocations_out(tenant_id, self.allocations.search(tenant_id, route_id=route_id, status=status))

    def _get_allocation(self, tenant_id: uuid.UUID, allocation_id: uuid.UUID) -> TransportAllocation:
        allocation = self.allocations.get_by_id(tenant_id, allocation_id)
        if allocation is None:
            raise NotFoundError("Allocation not found")
        return allocation

    def update_allocation(
        self, tenant_id: uuid.UUID, allocation_id: uuid.UUID, payload: AllocationUpdate
    ) -> AllocationOut:
        allocation = self._get_allocation(tenant_id, allocation_id)
        data = payload.model_dump(exclude_unset=True)
        new_route = data.get("route_id") or allocation.route_id
        new_stop = data.get("stop_id") or allocation.stop_id
        if new_route != allocation.route_id or new_stop != allocation.stop_id:
            old_route = self._get_route(tenant_id, allocation.route_id)
            target_route = self._get_route(tenant_id, new_route)
            moving_in = allocation.status == "active" and target_route.vehicle_id != old_route.vehicle_id
            self._check_route_stop_capacity(tenant_id, new_route, new_stop, moving_in=moving_in)
        for field, value in data.items():
            if field in ("route_id", "stop_id") and value is None:
                continue
            setattr(allocation, field, value)
        if allocation.end_date is not None and allocation.end_date < allocation.start_date:
            raise ConflictError("End date cannot be before start date")
        self.db.commit()
        self.db.refresh(allocation)
        return self._allocations_out(tenant_id, [allocation])[0]

    def end_allocation(self, tenant_id: uuid.UUID, allocation_id: uuid.UUID, end_date: date | None) -> AllocationOut:
        allocation = self._get_allocation(tenant_id, allocation_id)
        if allocation.status != "active":
            raise ConflictError("Allocation is already inactive")
        allocation.end_date = end_date or date.today()
        allocation.status = "inactive"
        self.db.commit()
        self.db.refresh(allocation)
        return self._allocations_out(tenant_id, [allocation])[0]

    # ------------------------------------------------------------------ fees
    def _fee_records_out(self, tenant_id: uuid.UUID, records: list[TransportFeeRecord]) -> list[TransportFeeRecordOut]:
        names = student_names(self.db, tenant_id, [r.student_id for r in records])
        out = []
        for r in records:
            invoice = self.invoices.get_by_id(tenant_id, r.invoice_id)
            out.append(
                TransportFeeRecordOut(
                    id=r.id,
                    student_id=r.student_id,
                    student_name=names.get(r.student_id),
                    allocation_id=r.allocation_id,
                    invoice_id=r.invoice_id,
                    invoice_number=invoice.invoice_number if invoice else None,
                    invoice_status=(invoice.status.value if hasattr(invoice.status, "value") else str(invoice.status))
                    if invoice
                    else None,
                    period_month=r.period_month,
                    period_year=r.period_year,
                    amount=float(r.amount),
                )
            )
        return out

    def generate_fees(self, tenant_id: uuid.UUID, payload: TransportFeeGenerate) -> TransportFeeGenerateResult:
        first_day, last_day = month_bounds(payload.period_month, payload.period_year)
        label = f"{MONTH_NAMES[payload.period_month]} {payload.period_year}"
        created: list[TransportFeeRecord] = []
        skipped: list[str] = []
        candidates = [
            a
            for a in self.allocations.search(tenant_id, status="all")
            if a.start_date <= last_day and (a.end_date is None or a.end_date >= first_day)
            and (a.status == "active" or a.end_date is not None)
        ]
        names_cache = student_names(self.db, tenant_id, [a.student_id for a in candidates])
        seen: set[uuid.UUID] = set()
        for allocation in candidates:
            name = names_cache.get(allocation.student_id, str(allocation.student_id))
            if allocation.student_id in seen:
                continue
            seen.add(allocation.student_id)
            if self.fee_records.get_for_period(
                tenant_id, allocation.student_id, payload.period_month, payload.period_year
            ):
                skipped.append(f"{name}: already billed for {label}")
                continue
            student = get_student_or_404(self.db, tenant_id, allocation.student_id)
            if student.class_grade_id is None:
                skipped.append(f"{name}: not assigned to a class")
                continue
            stop = self.stops.get_by_id(tenant_id, allocation.stop_id)
            fare = float(stop.monthly_fare) if stop else 0.0
            if fare <= 0:
                skipped.append(f"{name}: stop has no monthly fare")
                continue
            invoice = issue_other_invoice(
                self.db, tenant_id, student, fare, payload.due_date, f"Transport fee {label}"
            )
            created.append(
                self.fee_records.create(
                    TransportFeeRecord(
                        tenant_id=tenant_id,
                        student_id=student.id,
                        allocation_id=allocation.id,
                        invoice_id=invoice.id,
                        period_month=payload.period_month,
                        period_year=payload.period_year,
                        amount=fare,
                    )
                )
            )
        self.db.commit()
        return TransportFeeGenerateResult(
            created_count=len(created),
            skipped_count=len(skipped),
            skipped=skipped,
            records=self._fee_records_out(tenant_id, created),
        )

    def list_fee_records(
        self, tenant_id: uuid.UUID, month: int | None = None, year: int | None = None
    ) -> list[TransportFeeRecordOut]:
        return self._fee_records_out(tenant_id, self.fee_records.search(tenant_id, month, year))

    # ------------------------------------------------------------------ reports
    def route_strength(self, tenant_id: uuid.UUID) -> list[RouteStrengthRow]:
        rows = []
        for route in self.routes.list_ordered(tenant_id):
            vehicle = self.vehicles.get_by_id(tenant_id, route.vehicle_id) if route.vehicle_id else None
            students = self._allocations_out(
                tenant_id, self.allocations.search(tenant_id, route_id=route.id, status="active")
            )
            rows.append(
                RouteStrengthRow(
                    route_id=route.id,
                    route_name=route.name,
                    vehicle_registration=vehicle.registration_number if vehicle else None,
                    capacity=vehicle.capacity if vehicle else None,
                    student_count=len(students),
                    students=sorted(students, key=lambda s: s.student_name or ""),
                )
            )
        return rows

    def expiring_documents(self, tenant_id: uuid.UUID, days: int = 30) -> list[ExpiringDocumentRow]:
        today = date.today()
        horizon = today + timedelta(days=days)
        rows: list[ExpiringDocumentRow] = []

        def add(kind: str, ref: uuid.UUID, label: str, expiry: date | None) -> None:
            if expiry is not None and expiry <= horizon:
                rows.append(
                    ExpiringDocumentRow(
                        kind=kind, reference_id=ref, label=label, expiry_date=expiry, days_left=(expiry - today).days
                    )
                )

        for v in self.vehicles.list_ordered(tenant_id):
            add("vehicle_insurance", v.id, v.registration_number, v.insurance_expiry)
            add("vehicle_fitness", v.id, v.registration_number, v.fitness_expiry)
        for d in self.drivers.list_ordered(tenant_id):
            add("driver_license", d.id, d.full_name, d.license_expiry)
        return sorted(rows, key=lambda r: r.expiry_date)

    # ------------------------------------------------------------------ portal
    def _my_transport_for(self, tenant_id: uuid.UUID, student_id: uuid.UUID, name: str | None) -> MyTransportOut:
        allocation = self.allocations.active_for_student(tenant_id, student_id)
        if allocation is None:
            return MyTransportOut(student_id=student_id, student_name=name)
        route = self.routes.get_by_id(tenant_id, allocation.route_id)
        stop = self.stops.get_by_id(tenant_id, allocation.stop_id)
        vehicle = self.vehicles.get_by_id(tenant_id, route.vehicle_id) if route and route.vehicle_id else None
        driver = self.drivers.get_by_id(tenant_id, vehicle.driver_id) if vehicle and vehicle.driver_id else None
        return MyTransportOut(
            student_id=student_id,
            student_name=name,
            allocation_id=allocation.id,
            route_name=route.name if route else None,
            route_code=route.code if route else None,
            stop_name=stop.name if stop else None,
            pickup_type=allocation.pickup_type,
            pickup_time=stop.pickup_time if stop else None,
            drop_time=stop.drop_time if stop else None,
            monthly_fare=float(stop.monthly_fare) if stop else None,
            vehicle_registration=vehicle.registration_number if vehicle else None,
            vehicle_type=vehicle.vehicle_type if vehicle else None,
            driver_name=driver.full_name if driver else None,
            driver_phone=driver.phone if driver else None,
            conductor_name=vehicle.conductor_name if vehicle else None,
            conductor_phone=vehicle.conductor_phone if vehicle else None,
        )

    def my_transport(self, user: User) -> list[MyTransportOut]:
        ids = visible_student_ids(self.db, user)
        names = student_names(self.db, user.tenant_id, ids)
        return [self._my_transport_for(user.tenant_id, sid, names.get(sid)) for sid in ids]

    def student_transport(self, user: User, student_id: uuid.UUID) -> MyTransportOut:
        assert_can_view_student(self.db, user, student_id)
        names = student_names(self.db, user.tenant_id, [student_id])
        return self._my_transport_for(user.tenant_id, student_id, names.get(student_id))
