from prometheus_client import Counter, Gauge, generate_latest, CONTENT_TYPE_LATEST
import time

START_TIME = time.time()

VERIFICATIONS_TOTAL = Counter('verifications_total', 'Total number of student verifications attempted')
VERIFICATION_FAILURES_TOTAL = Counter('verification_failures_total', 'Total number of failed verifications')
OCR_ERRORS_TOTAL = Counter('ocr_errors_total', 'Total number of OCR processing errors')
ACTIVE_SESSIONS = Gauge('active_sessions', 'Number of active user sessions')

def get_uptime():
    return time.time() - START_TIME
