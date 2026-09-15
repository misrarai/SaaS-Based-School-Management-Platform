from enum import Enum


class GradeBand(str, Enum):
    PRIMARY = "primary"
    MIDDLE = "middle"
    SECONDARY = "secondary"


def grade_band(level_order: int) -> GradeBand:
    """Class 1-5 -> Primary, 6-8 -> Middle, 9+ -> Secondary (open-ended so O-Level rows classify too)."""
    if level_order <= 5:
        return GradeBand.PRIMARY
    if level_order <= 8:
        return GradeBand.MIDDLE
    return GradeBand.SECONDARY
