import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.models.inventory import (
    FixedAsset,
    InventoryItem,
    InventoryUnit,
    ItemCategory,
    StockMovement,
    StockTransaction,
    StockTxnType,
    Store,
    Supplier,
)
from app.repositories.base import BaseRepository


class CategoryRepository(BaseRepository[ItemCategory]):
    model = ItemCategory


class UnitRepository(BaseRepository[InventoryUnit]):
    model = InventoryUnit


class StoreRepository(BaseRepository[Store]):
    model = Store


class SupplierRepository(BaseRepository[Supplier]):
    model = Supplier


class ItemRepository(BaseRepository[InventoryItem]):
    model = InventoryItem

    def get_by_code(self, tenant_id: uuid.UUID, code: str) -> InventoryItem | None:
        stmt = select(InventoryItem).where(InventoryItem.tenant_id == tenant_id, InventoryItem.code == code)
        return self.db.execute(stmt).scalar_one_or_none()

    def search(self, tenant_id: uuid.UUID, query: str | None = None,
               category_id: uuid.UUID | None = None) -> list[InventoryItem]:
        stmt = select(InventoryItem).where(InventoryItem.tenant_id == tenant_id)
        if category_id:
            stmt = stmt.where(InventoryItem.category_id == category_id)
        if query:
            like = f"%{query}%"
            stmt = stmt.where(InventoryItem.name.ilike(like) | InventoryItem.code.ilike(like))
        return list(self.db.execute(stmt.order_by(InventoryItem.name)).scalars().all())


class StockRepository(BaseRepository[StockTransaction]):
    model = StockTransaction

    def get_with_lines(self, tenant_id: uuid.UUID, txn_id: uuid.UUID) -> StockTransaction | None:
        stmt = (
            select(StockTransaction)
            .options(selectinload(StockTransaction.lines))
            .where(StockTransaction.tenant_id == tenant_id, StockTransaction.id == txn_id)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_by_type(self, tenant_id: uuid.UUID, txn_type: StockTxnType | None) -> list[StockTransaction]:
        stmt = select(StockTransaction).options(selectinload(StockTransaction.lines)).where(
            StockTransaction.tenant_id == tenant_id
        )
        if txn_type:
            stmt = stmt.where(StockTransaction.txn_type == txn_type)
        stmt = stmt.order_by(StockTransaction.txn_date.desc(), StockTransaction.txn_number.desc())
        return list(self.db.execute(stmt).scalars().all())

    def numbers_for_type(self, tenant_id: uuid.UUID, txn_type: StockTxnType) -> list[str]:
        stmt = select(StockTransaction.txn_number).where(
            StockTransaction.tenant_id == tenant_id, StockTransaction.txn_type == txn_type
        )
        return list(self.db.execute(stmt).scalars().all())

    def stock_by_item_store(self, tenant_id: uuid.UUID) -> dict[tuple[uuid.UUID, uuid.UUID], float]:
        stmt = (
            select(StockMovement.item_id, StockMovement.store_id, func.sum(StockMovement.quantity))
            .where(StockMovement.tenant_id == tenant_id)
            .group_by(StockMovement.item_id, StockMovement.store_id)
        )
        return {(r[0], r[1]): float(r[2] or 0) for r in self.db.execute(stmt).all()}

    def quantity(self, tenant_id: uuid.UUID, item_id: uuid.UUID, store_id: uuid.UUID) -> float:
        stmt = select(func.sum(StockMovement.quantity)).where(
            StockMovement.tenant_id == tenant_id,
            StockMovement.item_id == item_id,
            StockMovement.store_id == store_id,
        )
        return float(self.db.execute(stmt).scalar() or 0)


class AssetRepository(BaseRepository[FixedAsset]):
    model = FixedAsset

    def get_by_tag(self, tenant_id: uuid.UUID, tag: str) -> FixedAsset | None:
        stmt = select(FixedAsset).where(FixedAsset.tenant_id == tenant_id, FixedAsset.asset_tag == tag)
        return self.db.execute(stmt).scalar_one_or_none()
