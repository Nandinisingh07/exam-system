"""
Enhanced Face Service — DeepFace / Facenet512 with liveness detection.
"""
import os
import pickle
import tempfile

import cv2
import numpy as np
from deepface import DeepFace

from ..config import settings

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MODEL_NAME      = "Facenet512"
DISTANCE_METRIC = "cosine"
COSINE_THRESHOLD = 0.40          # distance < threshold → match
BLUR_THRESHOLD   = 40            # laplacian variance below this = too blurry

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _eye_aspect_ratio(landmarks: list) -> float:
    """
    Approximate EAR (Eye Aspect Ratio) from 6-point eye landmarks.
    Used for blink detection proxy. Returns value 0–1.
    """
    try:
        p1, p2, p3, p4, p5, p6 = landmarks
        vertical_1 = np.linalg.norm(np.array(p2) - np.array(p6))
        vertical_2 = np.linalg.norm(np.array(p3) - np.array(p5))
        horizontal = np.linalg.norm(np.array(p1) - np.array(p4))
        ear = (vertical_1 + vertical_2) / (2.0 * horizontal + 1e-6)
        return ear
    except Exception:
        return 0.3   # neutral fallback


def _texture_liveness_score(gray: np.ndarray) -> float:
    """
    Passive liveness: real faces have natural skin texture variance.
    Printed photos are too uniform. Returns 0–1.
    """
    lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    # Real face webcam: typically 100–800, Printed photo: 20–80
    score = min(lap_var / 400.0, 1.0)
    return float(score)


def compute_liveness_score(image: np.ndarray) -> float:
    """
    Single-frame passive liveness using texture analysis.
    Returns 0.0 (fake) – 1.0 (real).
    Multi-frame blink detection requires video stream (future enhancement).
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image

    # Texture score
    texture = _texture_liveness_score(gray)

    # Reflection check: printed photos / screens have uniform high brightness
    mean_brightness = gray.mean() / 255.0
    # Real faces: 0.3–0.7; screens/photos: >0.85 or very uniform
    brightness_penalty = 1.0 if 0.15 < mean_brightness < 0.85 else 0.3

    liveness = texture * 0.7 + brightness_penalty * 0.3
    return round(min(liveness, 1.0), 4)


# ---------------------------------------------------------------------------
# Core face functions
# ---------------------------------------------------------------------------

def encode_face_from_bytes(image_bytes: bytes):
    """
    Accept raw image bytes, detect face, return (512-D encoding, error_string).
    Returns (None, error_msg) on failure.
    """
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            return None, "Corrupt image data"

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Quality: blur check
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        if laplacian_var < BLUR_THRESHOLD:
            return None, "Image is too blurry. Please stay still and ensure good lighting."

        # Write to temp file — DeepFace needs file path
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            tmp_path = tmp.name
            cv2.imwrite(tmp_path, image)

        try:
            embedding_objs = DeepFace.represent(
                img_path=tmp_path,
                model_name=MODEL_NAME,
                enforce_detection=True,
                detector_backend="opencv",
                align=True,
            )
        except ValueError:
            return None, "No face detected. Ensure your face is clearly visible and centred."
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

        if not embedding_objs:
            return None, "Failed to extract face features."

        encoding = np.array(embedding_objs[0]["embedding"])
        return encoding, None

    except Exception as e:
        print(f"[FaceService] encode error: {e}")
        return None, "System error during face processing."


def compare_faces(stored_encoding_bytes: bytes, live_encoding: np.ndarray):
    """
    Compare stored (pickle) encoding with live numpy encoding.
    Returns (is_match: bool, confidence_pct: float, error: str|None)
    """
    try:
        known = pickle.loads(stored_encoding_bytes)

        a = np.array(known, dtype=np.float64)
        b = np.array(live_encoding, dtype=np.float64)

        dot   = np.dot(a, b)
        norm  = (np.linalg.norm(a) * np.linalg.norm(b)) + 1e-10
        cosine_distance = float(1.0 - dot / norm)

        is_match = cosine_distance < COSINE_THRESHOLD

        # Convert to percentage:  0 distance → 100%, threshold distance → 50%
        if is_match:
            confidence = 80.0 + 20.0 * (1.0 - cosine_distance / COSINE_THRESHOLD)
        else:
            confidence = max(0.0, 80.0 * (1.0 - cosine_distance / (COSINE_THRESHOLD * 2)))

        return bool(is_match), round(confidence, 2), None

    except Exception as e:
        print(f"[FaceService] compare error: {e}")
        return False, 0.0, "Face comparison failed."


def get_liveness_from_bytes(image_bytes: bytes) -> float:
    """Compute liveness score from raw image bytes."""
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            return 0.0
        return compute_liveness_score(image)
    except Exception:
        return 0.5   # Neutral on error — don't block


def serialize_encoding(encoding: np.ndarray) -> bytes:
    return pickle.dumps(encoding)