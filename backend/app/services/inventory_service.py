"""Inventory & assets: masters, stock documents (purchase / issue / adjustment / transfer / POS sale),
computed stock levels, low-stock report and a straight-line depreciated fixed-asset register."""

import uuid
from collections import defaultdict
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, DomainError, NotFoundError
from app.models.inventory import (
    AssetStatus,
    FixedAsset,
    InventoryItem,
    InventoryUnit,
    ItemCategory,
    StockMovement,
    StockTransaction,
    StockTransactionLine,
    StockTxnType,
    Store,
    Supplier,
)
from app.models.user import StudentProfile, User
from app.repositories.inventory_repo import (
    AssetRepository,
    CategoryRepository,
    ItemRepository,
    StockRepository,
    StoreRepository,
    SupplierRepository,
    UnitRepository,
)
from app.schemas.inventory import (
    AdjustmentCreate,
    AssetCreate,
    AssetDispose,
    AssetOut,
    AssetUpdate,
    CategoryIn,
    IssueCreate,
    ItemCreate,
    ItemOut,
    ItemUpdate,
    LowStockRow,
    PurchaseCreate,
    SaleCreate,
    StockLevel,
    StockLineIn,
    StockLineOut,
    StockTxnOut,
    StoreIn,
    StoreUpdate,
    SupplierIn,
    SupplierUpdate,
    TransferCreate,
    UnitIn,
)


class UnprocessableError(DomainError):
    status_code = 422


CENT = Decimal("0.01")
TXN_PREFIX = {
    StockTxnType.PURCHASE: "PUR",
    StockTxnType.ISSUE: "ISS",
    StockTxnType.ADJUSTMENT: "ADJ",
    StockTxnType.TRANSFER: "TRF",
    StockTxnType.SALE: "SAL",
}


def _d(v) -> Decimal:
    return Decimal(str(v or 0)).quantize(CENT, rounding=ROUND_HALF_UP)


class InventoryService:
    def __init__(self, db: Session):
        self.db = db
        self.categories = CategoryRepository(db)
        self.units = UnitRepository(db)
        self.stores = StoreRepository(db)
        self.suppliers = SupplierRepository(db)
        self.items = ItemRepository(db)
        self.stock = StockRepository(db)
        self.assets = AssetRepository(db)

    def _add(self, obj):
        self.db.add(obj)
        return obj

    def _commit(self, conflict_message: str) -> None:
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise ConflictError(conflict_message) from exc

    @staticmethod
    def _get(repo, tenant_id: uuid.UUID, id_: uuid.UUID, label: str):
        obj = repo.get_by_id(tenant_id, id_)
        if obj is None:
            raise NotFoundError(f"{label} not found")
        return obj

    # ================= Simple masters =================
    def list_categories(self, tenant_id):
        return sorted(self.categories.list(tenant_id), key=lambda c: c.name.lower())

    def create_category(self, tenant_id, payload: CategoryIn) -> ItemCategory:
        obj = self._add(ItemCategory(tenant_id=tenant_id, **payload.model_dump()))
        self._commit("A category with this name already exists")
        return obj

    def update_category(self, tenant_id, category_id, payload: CategoryIn) -> ItemCategory:
        obj = self._get(self.categories, tenant_id, category_id, "Category")
        obj.name, obj.description = payload.name, payload.description
        self._commit("A category with this name already exists")
        return obj

    def delete_category(self, tenant_id, category_id) -> None:
        obj = self._get(self.categories, tenant_id, category_id, "Category")
        if any(i.category_id == obj.id for i in self.items.list(tenant_id)):
            raise ConflictError("Category is used by items")
        self.db.delete(obj)
        self.db.commit()

    def list_units(self, tenant_id):
        return sorted(self.units.list(tenant_id), key=lambda u: u.name.lower())

    def create_unit(self, tenant_id, payload: UnitIn) -> InventoryUnit:
        obj = self._add(InventoryUnit(tenant_id=tenant_id, **payload.model_dump()))
        self._commit("A unit with this name already exists")
        return obj

    def delete_unit(self, tenant_id, unit_id) -> None:
        obj = self._get(self.units, tenant_id, unit_id, "Unit")
        if any(i.unit_id == obj.id for i in self.items.list(tenant_id)):
            raise ConflictError("Unit is used by items")
        self.db.delete(obj)
        self.db.commit()

    def list_stores(self, tenant_id):
        return sorted(self.stores.list(tenant_id), key=lambda s: s.name.lower())

    def create_store(self, tenant_id, payload: StoreIn) -> Store:
        obj = self._add(Store(tenant_id=tenant_id, **payload.model_dump()))
        self._commit("A store with this name already exists")
        return obj

    def update_store(self, tenant_id, store_id, payload: StoreUpdate) -> Store:
        obj = self._get(self.stores, tenant_id, store_id, "Store")
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(obj, k, v)
        self._commit("A store with this name already exists")
        return obj

    def list_suppliers(self, tenant_id):
        return sorted(self.suppliers.list(tenant_id), key=lambda s: s.name.lower())

    def create_supplier(self, tenant_id, payload: SupplierIn) -> Supplier:
        obj = self.suppliers.create(Supplier(tenant_id=tenant_id, **payload.model_dump()))
        self.db.commit()
        return obj

    def update_supplier(self, tenant_id, supplier_id, payload: SupplierUpdate) -> Supplier:
        obj = self._get(self.suppliers, tenant_id, supplier_id, "Supplier")
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(obj, k, v)
        self.db.commit()
        return obj

    # ================= Items =================
    def _item_out(self, item: InventoryItem, cats: dict, units: dict, totals: dict) -> ItemOut:
        return ItemOut(
            id=item.id, name=item.name, code=item.code, category_id=item.category_id,
            category_name=cats.get(item.category_id), unit_id=item.unit_id, unit_name=units.get(item.unit_id),
            reorder_level=float(item.reorder_level or 0),
            sale_price=float(item.sale_price) if item.sale_price is not None else None,
            description=item.description, is_active=item.is_active, current_stock=totals.get(item.id, 0.0),
        )

    def _lookups(self, tenant_id):
        cats = {c.id: c.name for c in self.categories.list(tenant_id)}
        units = {u.id: (u.abbreviation or u.name) for u in self.units.list(tenant_id)}
        totals: dict[uuid.UUID, float] = defaultdict(float)
        for (item_id, _), qty in self.stock.stock_by_item_store(tenant_id).items():
            totals[item_id] += qty
        return cats, units, totals

    def list_items(self, tenant_id, query=None, category_id=None) -> list[ItemOut]:
        cats, units, totals = self._lookups(tenant_id)
        return [self._item_out(i, cats, units, totals) for i in self.items.search(tenant_id, query, category_id)]

    def get_item_out(self, tenant_id, item_id) -> ItemOut:
        item = self._get(self.items, tenant_id, item_id, "Item")
        cats, units, totals = self._lookups(tenant_id)
        return self._item_out(item, cats, units, totals)

    def _validate_refs(self, tenant_id, category_id, unit_id):
        if category_id:
            self._get(self.categories, tenant_id, category_id, "Category")
        if unit_id:
            self._get(self.units, tenant_id, unit_id, "Unit")

    def _next_item_code(self, tenant_id) -> str:
        highest = 0
        for i in self.items.list(tenant_id):
            if i.code.startswith("ITM-") and i.code[4:].isdigit():
                highest = max(highest, int(i.code[4:]))
        return f"ITM-{highest + 1:04d}"

    def create_item(self, tenant_id, payload: ItemCreate) -> ItemOut:
        self._validate_refs(tenant_id, payload.category_id, payload.unit_id)
        code = (payload.code or "").strip() or self._next_item_code(tenant_id)
        if self.items.get_by_code(tenant_id, code):
            raise ConflictError(f"Item code {code} already exists")
        data = payload.model_dump()
        data["code"] = code
        item = self._add(InventoryItem(tenant_id=tenant_id, **data))
        self._commit("Item code already exists")
        return self.get_item_out(tenant_id, item.id)

    def update_item(self, tenant_id, item_id, payload: ItemUpdate) -> ItemOut:
        item = self._get(self.items, tenant_id, item_id, "Item")
        data = payload.model_dump(exclude_unset=True)
        self._validate_refs(tenant_id, data.get("category_id"), data.get("unit_id"))
        if "code" in data and data["code"] != item.code and self.items.get_by_code(tenant_id, data["code"]):
            raise ConflictError(f"Item code {data['code']} already exists")
        for k, v in data.items():
            setattr(item, k, v)
        self._commit("Item code already exists")
        return self.get_item_out(tenant_id, item.id)

    # ================= Stock documents =================
    def _next_txn_number(self, tenant_id, txn_type: StockTxnType) -> str:
        prefix = TXN_PREFIX[txn_type] + "-"
        highest = 0
        for n in self.stock.numbers_for_type(tenant_id, txn_type):
            tail = n[len(prefix):]
            if n.startswith(prefix) and tail.isdigit():
                highest = max(highest, int(tail))
        return f"{prefix}{highest + 1:04d}"

    def _check_available(self, tenant_id, store: Store, lines: list[StockLineIn]) -> None:
        needed: dict[uuid.UUID, Decimal] = defaultdict(Decimal)
        for line in lines:
            needed[line.item_id] += _d(line.quantity)
        for item_id, qty in needed.items():
            available = _d(self.stock.quantity(tenant_id, item_id, store.id))
            if qty > available:
                item = self.items.get_by_id(tenant_id, item_id)
                raise UnprocessableError(
                    f"Insufficient stock for {item.name if item else item_id} in {store.name}: "
                    f"available {available}, requested {qty}"
                )

    def _create_txn(self, tenant_id, user_id, txn_type: StockTxnType, store: Store, txn_date: date,
                    lines: list[StockLineIn], sign: int, *, to_store: Store | None = None,
                    default_price_from_item: bool = False, **header) -> StockTransaction:
        for line in lines:  # validate before anything is flushed
            item = self._get(self.items, tenant_id, line.item_id, "Item")
            if not item.is_active:
                raise UnprocessableError(f"Item {item.name} is inactive")
        txn = StockTransaction(
            tenant_id=tenant_id, txn_type=txn_type, txn_number=self._next_txn_number(tenant_id, txn_type),
            txn_date=txn_date, store_id=store.id, to_store_id=to_store.id if to_store else None,
            created_by_user_id=user_id, **header,
        )
        self.db.add(txn)
        self.db.flush()
        total = Decimal(0)
        for idx, line in enumerate(lines, start=1):
            item = self.items.get_by_id(tenant_id, line.item_id)
            price = line.unit_price
            if price is None:
                price = float(item.sale_price or 0) if default_price_from_item else 0
            qty, unit_price = _d(line.quantity), _d(price)
            line_total = (qty * unit_price).quantize(CENT)
            total += line_total
            self.db.add(StockTransactionLine(
                tenant_id=tenant_id, transaction_id=txn.id, item_id=item.id, line_no=idx,
                quantity=qty, unit_price=unit_price, line_total=line_total,
            ))
            self.db.add(StockMovement(
                tenant_id=tenant_id, transaction_id=txn.id, item_id=item.id, store_id=store.id,
                quantity=qty * sign, movement_date=txn_date,
            ))
            if to_store is not None:
                self.db.add(StockMovement(
                    tenant_id=tenant_id, transaction_id=txn.id, item_id=item.id, store_id=to_store.id,
                    quantity=qty, movement_date=txn_date,
                ))
        txn.total_amount = total - _d(txn.discount)
        self.db.flush()
        return txn

    def _store(self, tenant_id, store_id) -> Store:
        store = self._get(self.stores, tenant_id, store_id, "Store")
        if not store.is_active:
            raise UnprocessableError(f"Store {store.name} is inactive")
        return store

    def create_purchase(self, tenant_id, user_id, payload: PurchaseCreate) -> StockTxnOut:
        store = self._store(tenant_id, payload.store_id)
        if payload.supplier_id:
            self._get(self.suppliers, tenant_id, payload.supplier_id, "Supplier")
        txn = self._create_txn(
            tenant_id, user_id, StockTxnType.PURCHASE, store, payload.txn_date, payload.lines, +1,
            supplier_id=payload.supplier_id, invoice_no=payload.invoice_no, notes=payload.notes,
        )
        self.db.commit()
        return self.get_txn(tenant_id, txn.id)

    def create_issue(self, tenant_id, user_id, payload: IssueCreate) -> StockTxnOut:
        store = self._store(tenant_id, payload.store_id)
        self._check_available(tenant_id, store, payload.lines)
        txn = self._create_txn(
            tenant_id, user_id, StockTxnType.ISSUE, store, payload.txn_date, payload.lines, -1,
            issued_to_type=payload.issued_to_type, issued_to=payload.issued_to, notes=payload.notes,
        )
        self.db.commit()
        return self.get_txn(tenant_id, txn.id)

    def create_adjustment(self, tenant_id, user_id, payload: AdjustmentCreate) -> StockTxnOut:
        store = self._store(tenant_id, payload.store_id)
        sign = -1 if payload.direction == "decrease" else 1
        if sign < 0:
            self._check_available(tenant_id, store, payload.lines)
        txn = self._create_txn(
            tenant_id, user_id, StockTxnType.ADJUSTMENT, store, payload.txn_date, payload.lines, sign,
            reason=payload.reason, notes=payload.notes,
        )
        self.db.commit()
        return self.get_txn(tenant_id, txn.id)

    def create_transfer(self, tenant_id, user_id, payload: TransferCreate) -> StockTxnOut:
        if payload.store_id == payload.to_store_id:
            raise UnprocessableError("Source and destination stores must differ")
        store = self._store(tenant_id, payload.store_id)
        to_store = self._store(tenant_id, payload.to_store_id)
        self._check_available(tenant_id, store, payload.lines)
        txn = self._create_txn(
            tenant_id, user_id, StockTxnType.TRANSFER, store, payload.txn_date, payload.lines, -1,
            to_store=to_store, notes=payload.notes,
        )
        self.db.commit()
        return self.get_txn(tenant_id, txn.id)

    def create_sale(self, tenant_id, user_id, payload: SaleCreate) -> StockTxnOut:
        store = self._store(tenant_id, payload.store_id)
        if payload.student_id:
            student = self.db.execute(
                select(StudentProfile).where(
                    StudentProfile.id == payload.student_id, StudentProfile.tenant_id == tenant_id
                )
            ).scalar_one_or_none()
            if student is None:
                raise NotFoundError("Student not found")
        self._check_available(tenant_id, store, payload.lines)
        txn = self._create_txn(
            tenant_id, user_id, StockTxnType.SALE, store, payload.txn_date, payload.lines, -1,
            default_price_from_item=True, student_id=payload.student_id, customer_name=payload.customer_name,
            payment_method=payload.payment_method, discount=_d(payload.discount), notes=payload.notes,
        )
        if txn.total_amount < 0:
            self.db.rollback()
            raise UnprocessableError("Discount cannot exceed the sale subtotal")
        if payload.amount_paid is not None and _d(payload.amount_paid) < _d(txn.total_amount):
            self.db.rollback()
            raise UnprocessableError("Amount paid is less than the sale total")
        txn.amount_paid = _d(payload.amount_paid) if payload.amount_paid is not None else txn.total_amount
        self.db.commit()
        return self.get_txn(tenant_id, txn.id)

    def get_txn(self, tenant_id, txn_id) -> StockTxnOut:
        txn = self.stock.get_with_lines(tenant_id, txn_id)
        if txn is None:
            raise NotFoundError("Stock transaction not found")
        return self._txn_outs(tenant_id, [txn])[0]

    def list_txns(self, tenant_id, txn_type: StockTxnType | None) -> list[StockTxnOut]:
        return self._txn_outs(tenant_id, self.stock.list_by_type(tenant_id, txn_type))

    def _txn_outs(self, tenant_id, txns: list[StockTransaction]) -> list[StockTxnOut]:
        items = {i.id: i for i in self.items.list(tenant_id)}
        stores = {s.id: s.name for s in self.stores.list(tenant_id)}
        suppliers = {s.id: s.name for s in self.suppliers.list(tenant_id)}
        student_ids = {t.student_id for t in txns if t.student_id}
        students: dict[uuid.UUID, str] = {}
        if student_ids:
            rows = self.db.execute(
                select(StudentProfile.id, User.full_name)
                .join(User, User.id == StudentProfile.user_id)
                .where(StudentProfile.id.in_(student_ids))
            ).all()
            students = {r[0]: r[1] for r in rows}
        out = []
        for t in txns:
            out.append(StockTxnOut(
                id=t.id, txn_type=t.txn_type, txn_number=t.txn_number, txn_date=t.txn_date,
                store_id=t.store_id, store_name=stores.get(t.store_id), to_store_id=t.to_store_id,
                to_store_name=stores.get(t.to_store_id), supplier_id=t.supplier_id,
                supplier_name=suppliers.get(t.supplier_id), invoice_no=t.invoice_no,
                issued_to_type=t.issued_to_type, issued_to=t.issued_to, reason=t.reason,
                student_id=t.student_id, student_name=students.get(t.student_id),
                customer_name=t.customer_name, payment_method=t.payment_method,
                discount=float(t.discount or 0), total_amount=float(t.total_amount or 0),
                amount_paid=float(t.amount_paid) if t.amount_paid is not None else None, notes=t.notes,
                lines=[
                    StockLineOut(
                        id=l.id, item_id=l.item_id,
                        item_name=items[l.item_id].name if l.item_id in items else None,
                        item_code=items[l.item_id].code if l.item_id in items else None,
                        quantity=float(l.quantity), unit_price=float(l.unit_price), line_total=float(l.line_total),
                    )
                    for l in t.lines
                ],
            ))
        return out

    # ================= Stock levels =================
    def stock_levels(self, tenant_id, store_id=None, item_id=None, include_zero=False) -> list[StockLevel]:
        items = {i.id: i for i in self.items.list(tenant_id)}
        stores = {s.id: s.name for s in self.stores.list(tenant_id)}
        units = {u.id: (u.abbreviation or u.name) for u in self.units.list(tenant_id)}
        rows = []
        for (iid, sid), qty in self.stock.stock_by_item_store(tenant_id).items():
            if (store_id and sid != store_id) or (item_id and iid != item_id):
                continue
            if not include_zero and abs(qty) < 0.005:
                continue
            item = items.get(iid)
            if item is None:
                continue
            rows.append(StockLevel(
                item_id=iid, item_name=item.name, item_code=item.code, unit_name=units.get(item.unit_id),
                store_id=sid, store_name=stores.get(sid, ""), quantity=round(qty, 2),
                reorder_level=float(item.reorder_level or 0),
            ))
        rows.sort(key=lambda r: (r.item_name.lower(), r.store_name.lower()))
        return rows

    def low_stock(self, tenant_id) -> list[LowStockRow]:
        cats, units, totals = self._lookups(tenant_id)
        rows = []
        for item in self.items.search(tenant_id):
            reorder = float(item.reorder_level or 0)
            qty = round(totals.get(item.id, 0.0), 2)
            if not item.is_active or reorder <= 0 or qty > reorder:
                continue
            rows.append(LowStockRow(
                item_id=item.id, item_name=item.name, item_code=item.code, unit_name=units.get(item.unit_id),
                category_name=cats.get(item.category_id), quantity=qty, reorder_level=reorder,
                shortfall=round(reorder - qty, 2),
            ))
        return rows

    # ================= Fixed assets =================
    @staticmethod
    def asset_out(asset: FixedAsset, as_of: date | None = None) -> AssetOut:
        cost, salvage = _d(asset.cost), _d(asset.salvage_value)
        rate = Decimal(str(asset.depreciation_rate or 0))
        depreciable = max(cost - salvage, Decimal(0))
        annual = (depreciable * rate / 100).quantize(CENT)
        end = asset.disposal_date if asset.status == AssetStatus.DISPOSED and asset.disposal_date else (
            as_of or date.today())
        days = max((end - asset.purchase_date).days, 0)
        accumulated = min((annual * Decimal(days) / Decimal("365")).quantize(CENT), depreciable)
        return AssetOut(
            id=asset.id, asset_tag=asset.asset_tag, name=asset.name, category=asset.category,
            location=asset.location, supplier_id=asset.supplier_id, purchase_date=asset.purchase_date,
            cost=float(cost), salvage_value=float(salvage), depreciation_rate=float(rate),
            assigned_to=asset.assigned_to, condition=asset.condition, status=asset.status,
            disposal_date=asset.disposal_date,
            disposal_value=float(asset.disposal_value) if asset.disposal_value is not None else None,
            disposal_notes=asset.disposal_notes, notes=asset.notes,
            accumulated_depreciation=float(accumulated), book_value=float(cost - accumulated),
            annual_depreciation=float(annual),
        )

    def list_assets(self, tenant_id, status: AssetStatus | None = None, as_of: date | None = None) -> list[AssetOut]:
        assets = [a for a in self.assets.list(tenant_id) if status is None or a.status == status]
        assets.sort(key=lambda a: a.asset_tag)
        return [self.asset_out(a, as_of) for a in assets]

    def _next_asset_tag(self, tenant_id) -> str:
        highest = 0
        for a in self.assets.list(tenant_id):
            if a.asset_tag.startswith("AST-") and a.asset_tag[4:].isdigit():
                highest = max(highest, int(a.asset_tag[4:]))
        return f"AST-{highest + 1:04d}"

    def create_asset(self, tenant_id, payload: AssetCreate) -> AssetOut:
        if payload.supplier_id:
            self._get(self.suppliers, tenant_id, payload.supplier_id, "Supplier")
        tag = (payload.asset_tag or "").strip() or self._next_asset_tag(tenant_id)
        if self.assets.get_by_tag(tenant_id, tag):
            raise ConflictError(f"Asset tag {tag} already exists")
        if payload.salvage_value > payload.cost:
            raise UnprocessableError("Salvage value cannot exceed cost")
        data = payload.model_dump()
        data["asset_tag"] = tag
        asset = self._add(FixedAsset(tenant_id=tenant_id, **data))
        self._commit("Asset tag already exists")
        return self.asset_out(asset)

    def update_asset(self, tenant_id, asset_id, payload: AssetUpdate) -> AssetOut:
        asset = self._get(self.assets, tenant_id, asset_id, "Asset")
        if asset.status == AssetStatus.DISPOSED:
            raise ConflictError("Disposed assets cannot be edited")
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(asset, k, v)
        self.db.commit()
        return self.asset_out(asset)

    def dispose_asset(self, tenant_id, asset_id, payload: AssetDispose) -> AssetOut:
        asset = self._get(self.assets, tenant_id, asset_id, "Asset")
        if asset.status == AssetStatus.DISPOSED:
            raise ConflictError("Asset is already disposed")
        if payload.disposal_date < asset.purchase_date:
            raise UnprocessableError("Disposal date cannot be before purchase date")
        asset.status = AssetStatus.DISPOSED
        asset.disposal_date = payload.disposal_date
        asset.disposal_value = payload.disposal_value
        asset.disposal_notes = payload.disposal_notes
        self.db.commit()
        return self.asset_out(asset)

    def get_asset(self, tenant_id, asset_id) -> AssetOut:
        return self.asset_out(self._get(self.assets, tenant_id, asset_id, "Asset"))
