import os
import sys
import urllib.request
import numpy as np
import cv2
import onnxruntime as ort

# Monkey-patch to bypass tensorflow import inside mediapipe (prevents protobuf version conflicts)
_real_tensorflow = sys.modules.get("tensorflow")
sys.modules["tensorflow"] = None
try:
    import mediapipe as mp
finally:
    if _real_tensorflow is not None:
        sys.modules["tensorflow"] = _real_tensorflow
    else:
        sys.modules.pop("tensorflow", None)

# Configuration
WEIGHTS_DIR = os.path.join(os.path.dirname(__file__), "weights")
ARCFACE_URL = "https://huggingface.co/onnxmodelzoo/arcfaceresnet100-8/resolve/main/arcfaceresnet100-8.onnx"
ARCFACE_PATH = os.path.join(WEIGHTS_DIR, "arcfaceresnet100-8.onnx")

LIVENESS_URL = "https://github.com/yakhyo/face-anti-spoofing/releases/download/weights/MiniFASNetV2.onnx"
LIVENESS_PATH = os.path.join(WEIGHTS_DIR, "MiniFASNetV2.onnx")

def _download_file(url: str, dest_path: str):
    print(f"Downloading weights from {url} to {dest_path}...", flush=True)
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    )
    with urllib.request.urlopen(req) as response:
        total_size = int(response.info().get('Content-Length', 0))
        downloaded = 0
        block_size = 1024 * 1024  # 1MB
        
        with open(dest_path, 'wb') as out_file:
            while True:
                buffer = response.read(block_size)
                if not buffer:
                    break
                downloaded += len(buffer)
                out_file.write(buffer)
                if total_size > 0:
                    percent = (downloaded / total_size) * 100
                    print(f"Downloaded {downloaded / (1024*1024):.2f}MB / {total_size / (1024*1024):.2f}MB ({percent:.2f}%)", flush=True)
                else:
                    print(f"Downloaded {downloaded / (1024*1024):.2f}MB", flush=True)
    print(f"Successfully downloaded {dest_path}", flush=True)

def ensure_weights_exist():
    # ArcFace (approx 249MB)
    if not os.path.exists(ARCFACE_PATH) or os.path.getsize(ARCFACE_PATH) < 1000000:
        _download_file(ARCFACE_URL, ARCFACE_PATH)
    else:
        print("ArcFace weights already exist.")
        
    # MiniFASNetV2 (approx 3MB)
    if not os.path.exists(LIVENESS_PATH) or os.path.getsize(LIVENESS_PATH) < 100000:
        _download_file(LIVENESS_URL, LIVENESS_PATH)
    else:
        print("MiniFASNetV2 weights already exist.")

def detect_face_mediapipe(image: np.ndarray):
    h, w, _ = image.shape
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    mp_face_detection = mp.solutions.face_detection
    with mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5) as face_detection:
        results = face_detection.process(image_rgb)
        if not results.detections:
            return None, None
        
        detection = max(results.detections, key=lambda x: x.score[0])
        bbox = detection.location_data.relative_bounding_box
        
        xmin = int(bbox.xmin * w)
        ymin = int(bbox.ymin * h)
        width = int(bbox.width * w)
        height = int(bbox.height * h)
        
        landmarks = []
        for keypoint in detection.location_data.relative_keypoints:
            landmarks.append((int(keypoint.x * w), int(keypoint.y * h)))
            
        return (xmin, ymin, width, height), landmarks

def crop_face_with_padding(image: np.ndarray, xmin: int, ymin: int, width: int, height: int, scale: float = 1.0):
    h, w, c = image.shape
    cx = xmin + width / 2
    cy = ymin + height / 2
    
    sw = width * scale
    sh = height * scale
    side = max(sw, sh)
    
    x1 = int(cx - side / 2)
    y1 = int(cy - side / 2)
    x2 = int(cx + side / 2)
    y2 = int(cy + side / 2)
    
    ix1 = max(0, x1)
    iy1 = max(0, y1)
    ix2 = min(w, x2)
    iy2 = min(h, y2)
    
    if ix2 <= ix1 or iy2 <= iy1:
        return np.zeros((int(side), int(side), c), dtype=np.uint8)
        
    crop = image[iy1:iy2, ix1:ix2]
    
    pad_top = iy1 - y1
    pad_bottom = y2 - iy2
    pad_left = ix1 - x1
    pad_right = x2 - ix2
    
    if pad_top > 0 or pad_bottom > 0 or pad_left > 0 or pad_right > 0:
        crop = cv2.copyMakeBorder(crop, pad_top, pad_bottom, pad_left, pad_right, cv2.BORDER_CONSTANT, value=[0, 0, 0])
        
    return crop

def main():
    print("Step 1: Checking and downloading models...")
    ensure_weights_exist()
    
    # Check if a sample face image is available
    faces_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "faces")
    if not os.path.exists(faces_dir):
        print(f"Error: faces directory not found at {faces_dir}")
        return
        
    sample_files = [f for f in os.listdir(faces_dir) if f.endswith('.jpg')]
    if not sample_files:
        print(f"Error: No sample face images found in {faces_dir}")
        return
        
    sample_path = os.path.join(faces_dir, sample_files[0])
    print(f"Step 2: Loading sample image: {sample_path}")
    image = cv2.imread(sample_path)
    if image is None:
        print("Error: Could not load sample image.")
        return
        
    print(f"Step 3: Detecting face using MediaPipe...")
    bbox, landmarks = detect_face_mediapipe(image)
    if bbox is None:
        print("Error: Face detection failed.")
        return
    print(f"Face detected at bbox: {bbox}")
    
    print("Step 4: Running ArcFace embedding extraction...")
    xmin, ymin, width, height = bbox
    face_crop = crop_face_with_padding(image, xmin, ymin, width, height, scale=1.0)
    face_rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
    face_resized = cv2.resize(face_rgb, (112, 112))
    face_normalized = (face_resized.astype(np.float32) - 127.5) / 127.5
    face_transposed = np.transpose(face_normalized, (2, 0, 1))
    input_tensor = np.expand_dims(face_transposed, axis=0)
    
    session = ort.InferenceSession(ARCFACE_PATH)
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    print(f"ArcFace input node: {input_name}, output node: {output_name}")
    
    embeddings = session.run([output_name], {input_name: input_tensor})[0]
    embedding = embeddings[0]
    embedding /= np.linalg.norm(embedding) + 1e-10
    print(f"Successfully extracted ArcFace embedding. Shape: {embedding.shape}, Norm: {np.linalg.norm(embedding):.4f}")
    print(f"First 5 elements of embedding: {embedding[:5]}")
    
    print("Step 5: Running MiniFASNetV2 liveness detection...")
    liveness_crop = crop_face_with_padding(image, xmin, ymin, width, height, scale=2.7)
    liveness_resized = cv2.resize(liveness_crop, (80, 80))
    liveness_rgb = cv2.cvtColor(liveness_resized, cv2.COLOR_BGR2RGB)
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    liveness_normalized = (liveness_rgb.astype(np.float32) / 255.0 - mean) / std
    liveness_transposed = np.transpose(liveness_normalized, (2, 0, 1))
    liveness_tensor = np.expand_dims(liveness_transposed, axis=0)
    
    liveness_session = ort.InferenceSession(LIVENESS_PATH)
    l_input_name = liveness_session.get_inputs()[0].name
    l_output_name = liveness_session.get_outputs()[0].name
    print(f"MiniFASNetV2 input node: {l_input_name}, output node: {l_output_name}")
    
    outputs = liveness_session.run([l_output_name], {l_input_name: liveness_tensor})[0]
    logits = outputs[0]
    exp_logits = np.exp(logits - np.max(logits))
    probs = exp_logits / np.sum(exp_logits)
    liveness_score = float(probs[2])
    print(f"MiniFASNetV2 raw outputs/logits: {logits}")
    print(f"Liveness probabilities -> Print Attack: {probs[0]:.4f}, Replay Attack: {probs[1]:.4f}, Real Face: {probs[2]:.4f}")
    print(f"Liveness score: {liveness_score:.4f}")
    
    print("\nVerification Script Completed Successfully!")

if __name__ == "__main__":
    main()
