f = open(r"C:\Users\Nandini singh\Exam-System\backend\app\routers\admin.py", "r", encoding="utf-8")
content = f.read()
f.close()

# Check actual User name field
from_idx = content.find("def get_overview")
end_idx = content.find("\n@router", from_idx + 10)
print("FUNCTION:", content[from_idx:from_idx+100])
print("USER field check needed")
