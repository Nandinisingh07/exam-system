f = open(r"C:\Users\Nandini singh\Exam-System\frontend\src\pages\invigilator\Kiosk.jsx", "r", encoding="utf-8")
content = f.read()
f.close()

old = content[content.find("{/* Exam select */}"):content.find("</div>", content.find("{/* Exam select */}"))+6]
print("FOUND BLOCK:")
print(repr(old[:100]))

