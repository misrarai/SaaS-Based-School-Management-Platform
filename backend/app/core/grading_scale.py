def letter_grade(percentage: float) -> str:
    """A conventional A/B/C/D/F scale — the only place this threshold table lives, so it can
    change in one spot if the academy wants a different cutoff later."""
    if percentage >= 90:
        return "A"
    if percentage >= 80:
        return "B"
    if percentage >= 70:
        return "C"
    if percentage >= 60:
        return "D"
    return "F"
