f = open(r"C:\Users\Nandini singh\Exam-System\backend\app\routers\verification.py", "r", encoding="utf-8")
lines = f.readlines()
f.close()

# Print lines around 285-295 to see the damage
for i, l in enumerate(lines[283:298], start=284):
    print(i, repr(l))
