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
    for tag in soup_box(["script", "style", "a", "iframe", "ins", "button"]):
        tag.decompose()
    text = soup_box.get_text(separator="\n")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n\n".join(lines)

def chapter_exists(novel_id, ch_num):
    res = supabase.table("chapters").select("id").eq("novel_id", novel_id).eq("chapter_number", ch_num).execute()
    return len(res.data) > 0

def process_novel_chapters(novel_id, novel_url):
    print(f"\n🔍 فحص الفصول الجديدة من: {novel_url}")
    try:
        res = requests.get(novel_url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(res.text, 'html.parser')
        links = soup.find_all('a', href=True)
        chapter_links = []
        for l in links:
            href = l['href']
            if re.search(r'chapter|فصل|\d+', href) and href not in chapter_links:
                chapter_links.append(href)
        print(f"📊 تم العثور على {len(chapter_links)} رابط فصل.")
    except Exception as e:
        print(f"❌ خطأ أثناء قراءة صفحة الرواية: {e}")

def start_scraping_loop():
    print("🚀 بدء تشغيل سكريبت السحب...")
    TARGET_NOVELS = [
        {"id": "b3009d79-80f1-4dbc-8081-fa4c356ec2b1", "url": "https://cenele.com/levels/"}
    ]
    for novel in TARGET_NOVELS:
        process_novel_chapters(novel["id"], novel["url"])

if __name__ == "__main__":
    start_scraping_loop()
