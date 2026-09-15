import os
import re
import requests
from bs4 import BeautifulSoup
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hazelnnjmkpkyrmanmcc.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}

def clean_content(soup_box):
    """تنظيف نص الفصل من العناصر المزعجة"""
    for tag in soup_box(["script", "style", "a", "iframe", "ins", "button"]):
        tag.decompose()
    text = soup_box.get_text(separator="\n")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n\n".join(lines)

def chapter_exists(novel_id, ch_num):
    """منع تكرار الفصل في قاعدة البيانات"""
    try:
        res = supabase.table("chapters").select("id").eq("novel_id", novel_id).eq("chapter_number", ch_num).execute()
        return len(res.data) > 0
    except Exception:
        return False

def fetch_and_save_chapter(novel_id, chapter_num, chapter_url):
    """سحب وقراءة نص الفصل وإدخاله في Supabase"""
    if chapter_exists(novel_id, chapter_num):
        print(f"⏩ الفصل {chapter_num} موجود مسبقاً، تم التجاوز.")
        return

    try:
        res = requests.get(chapter_url, headers=HEADERS, timeout=15)
        if res.status_code != 200:
            return

        soup = BeautifulSoup(res.text, 'html.parser')
        
        title_el = soup.find(['h1', 'h2'])
        title = title_el.text.strip() if title_el else f"الفصل {chapter_num}"

        content_box = soup.find('div', class_=re.compile(r'(entry-content|chapter-content|reading-content|text-left)'))
        if not content_box:
            content_box = soup.find('article') or soup

        clean_text = clean_content(content_box)

        data = {
            "novel_id": novel_id,
            "chapter_number": chapter_num,
            "title": title,
            "content": clean_text
        }
        supabase.table("chapters").insert(data).execute()
        print(f"✅ تم سحب وحفظ الفصل {chapter_num}: {title}")

    except Exception as e:
        print(f"❌ خطأ أثناء حفظ الفصل {chapter_num}: {e}")

def process_novel_chapters(novel_id, novel_url):
    print(f"\n🔍 فحص الفصول الجديدة من: {novel_url}")
    try:
        res = requests.get(novel_url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(res.text, 'html.parser')
        links = soup.find_all('a', href=True)
        
        chapter_links = []
        for l in links:
            href = l['href']
            if re.search(r'chapter|فصل', href, re.IGNORECASE) and href not in chapter_links:
                chapter_links.append(href)

        print(f"📊 تم العثور على {len(chapter_links)} رابط فصل.")

        for index, url in enumerate(chapter_links, start=1):
            match = re.search(r'(?:chapter|chapter-|فصل-?|/)\s*(\d+)', url, re.IGNORECASE)
            ch_num = int(match.group(1)) if match else index
            fetch_and_save_chapter(novel_id, ch_num, url)

    except Exception as e:
        print(f"❌ خطأ أثناء قراءة صفحة الرواية: {e}")

if __name__ == "__main__":
    TARGET_NOVELS = [
        {"id": "b3009d79-80f1-4dbc-8081-fa4c356ec2b1", "url": "https://cenele.com/levels/"}
    ]
    for novel in TARGET_NOVELS:
        process_novel_chapters(novel["id"], novel["url"])
