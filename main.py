import os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hazelnnjmkpkyrmanmcc.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def create_novel(title, description, cover_url, category_id=1):
    try:
        data = {
            "title": title,
            "description": description,
            "cover_url": cover_url,
            "category_id": category_id,
            "views": 0
        }
        res = supabase.table("novels").insert(data).execute()
        if res.data:
            novel_id = res.data[0]['id']
            print(f"✅ تم إضافة الرواية بنجاح: '{title}' (ID: {novel_id})")
            return novel_id
    except Exception as e:
        print(f"❌ خطأ أثناء إضافة الرواية: {e}")
        return None

def add_chapter(novel_id, ch_num, title, text):
    try:
        data = {
            "novel_id": novel_id,
            "chapter_number": ch_num,
            "title": title,
            "content": text
        }
        supabase.table("chapters").insert(data).execute()
        print(f"   └─ 📖 تم إضافة الفصل {ch_num}: {title}")
    except Exception as e:
        print(f"   └─ ❌ خطأ في إضافة الفصل: {e}")

if __name__ == "__main__":
    print("⚡ جاري الرفع التلقائي إلى Supabase...\n")
    novel_id = create_novel(
        title="رواية تجريبية جديدة",
        description="وصف تلقائي للرواية تم رفعه بواسطة السكريبت",
        cover_url="https://mskeimadil-lab.github.io/mskeimadil.github.io/assets/images/cover-placeholder.png"
    )
    if novel_id:
        add_chapter(novel_id, 1, "الفصل الأول: بداية المشوار", "هنا يوضع نص الفصل الأول...")
        add_chapter(novel_id, 2, "الفصل الثاني: الأحداث", "هنا يوضع نص الفصل الثاني...")
        print("\n🎉 تمت العملية بنجاح!")
