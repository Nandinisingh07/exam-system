"""
Confidence-Based Decision Engine.
Combines face, OCR, and ID scores into a final weighted confidence
and emits one of: AUTO_APPROVE / MANUAL_REVIEW / REJECT.
"""

# ---------------------------------------------------------------------------
# Weights (must sum to 1.0)
# ---------------------------------------------------------------------------
WEIGHTS = {
    "face":        0.40,
    "enrollment":  0.30,
    "name":        0.15,
    "father_name": 0.10,
    "id_card":     0.05,
}

# ---------------------------------------------------------------------------
# Decision Thresholds  (0–100 scale)
# ---------------------------------------------------------------------------
THRESHOLD_AUTO_APPROVE  = 85.0
THRESHOLD_MANUAL_REVIEW = 68.0
# Below manual review threshold → REJECT


def compute_confidence(
    face_score: float,        # 0–100
    enrollment_score: float,  # 0–1  (from OCR match)
    name_score: float,        # 0–1
    father_name_score: float, # 0–1
    id_score: float,          # 0–1
    liveness_score: float,    # 0–1
) -> dict:
    """
    Compute final confidence and decision.

    Returns a dict with:
      - final_confidence: float 0–100
      - decision: "AUTO_APPROVE" | "MANUAL_REVIEW" | "REJECT"
      - reason: human-readable explanation
      - component_scores: individual breakdown
      - reject_reason: set if decision == REJECT (for logging)
    """
    # Convert face_score to 0–1
    face_01 = face_score / 100.0

    # ── Hard gates (fail immediately regardless of other scores) ──────────
    if liveness_score < 0.40:
        return _reject(
            "Liveness check failed — possible photo/screen attack",
            face_01, enrollment_score, name_score, father_name_score, id_score, liveness_score
        )

    if enrollment_score < 0.45:
        return _reject(
            "Enrollment number unreadable or severely mismatched on admit card",
            face_01, enrollment_score, name_score, father_name_score, id_score, liveness_score
        )

    # ── Weighted composite ─────────────────────────────────────────────────
    composite = (
        face_01          * WEIGHTS["face"]       +
        enrollment_score * WEIGHTS["enrollment"] +
        name_score       * WEIGHTS["name"]       +
        father_name_score* WEIGHTS["father_name"]+
        id_score         * WEIGHTS["id_card"]
    )

    # Liveness modulates final score (acts as multiplier dampener)
    # Good liveness (≥0.7) → no penalty; poor liveness → reduce by up to 20%
    liveness_multiplier = 0.80 + (0.20 * min(liveness_score / 0.7, 1.0))
    final = min(composite * liveness_multiplier * 100.0, 100.0)

    # ── Decision ──────────────────────────────────────────────────────────
    if final >= THRESHOLD_AUTO_APPROVE:
        decision = "AUTO_APPROVE"
        reason   = "All verification criteria passed with high confidence."
    elif final >= THRESHOLD_MANUAL_REVIEW:
        decision = "MANUAL_REVIEW"
        reason   = _build_review_reason(enrollment_score, name_score, face_01, liveness_score)
    else:
        decision = "REJECT"
        reason   = _build_reject_reason(enrollment_score, name_score, face_01, liveness_score)

    return {
        "final_confidence": round(final, 2),
        "decision":         decision,
        "reason":           reason,
        "component_scores": {
            "face_score":        round(face_01 * 100, 2),
            "enrollment_score":  round(enrollment_score * 100, 2),
            "name_score":        round(name_score * 100, 2),
            "father_name_score": round(father_name_score * 100, 2),
            "id_score":          round(id_score * 100, 2),
            "liveness_score":    round(liveness_score * 100, 2),
        }
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _reject(reason, face, enroll, name, father, id_s, liveness):
    return {
        "final_confidence": 0.0,
        "decision":         "REJECT",
        "reason":           reason,
        "component_scores": {
            "face_score":        round(face * 100, 2),
            "enrollment_score":  round(enroll * 100, 2),
            "name_score":        round(name * 100, 2),
            "father_name_score": round(father * 100, 2),
            "id_score":          round(id_s * 100, 2),
            "liveness_score":    round(liveness * 100, 2),
        }
    }


def _build_review_reason(enroll, name, face, liveness) -> str:
    parts = []
    if enroll < 0.80:
        parts.append("enrollment number partially matched")
    if name < 0.70:
        parts.append("student name partially matched (OCR variance)")
    if face < 0.85:
        parts.append("face confidence is borderline")
    if liveness < 0.60:
        parts.append("liveness score low")
    if not parts:
        parts.append("composite score in review band")
    return "Manual review required: " + "; ".join(parts) + "."


def _build_reject_reason(enroll, name, face, liveness) -> str:
    parts = []
    if enroll < 0.50:
        parts.append("enrollment number could not be verified")
    if name < 0.50:
        parts.append("student name mismatch")
    if face < 0.70:
        parts.append("face biometric mismatch")
    if liveness < 0.50:
        parts.append("liveness check failed")
    return "Rejected: " + "; ".join(parts) if parts else "Rejected: overall confidence too low."
