import os
import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hazelnnjmkpkyrmanmcc.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}

def clean_page_junk(soup):
    # إزالة عناصر القوائم والمظهر والنوافذ المنبثقة والهيدر والفوتر
    for tag in soup(["script", "style", "a", "iframe", "ins", "button", "header", "footer", "nav", "aside"]):
        tag.decompose()
    for tag in soup.find_all(class_=re.compile(r'(modal|menu|sidebar|theme|header|footer|nav|widget)')):
        tag.decompose()

def clean_content(soup_box):
    clean_page_junk(soup_box)
    text = soup_box.get_text(separator="\n")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n\n".join(lines)

def ensure_novel_exists(novel_id, title):
    try:
        supabase.table("novels").upsert({
            "id": novel_id,
            "title": title
        }).execute()
        print(f"📖 تم التأكد من وجود الرواية: {title}")
    except Exception as e:
        print(f"⚠️ تعذر حفظ الرواية في جدول novels: {e}")

def fetch_and_save_chapter(novel_id, chapter_num, chapter_url):
    try:
        res = requests.get(chapter_url, headers=HEADERS, timeout=15)
        if res.status_code != 200:
            return

        soup = BeautifulSoup(res.text, 'html.parser')

        # البحث عن محتوى الفصل الفعلي أولاً
        content_box = soup.find('div', class_=re.compile(r'(entry-content|chapter-content|reading-content|text-left|post-body|epcontent)'))
        if not content_box:
            content_box = soup.find('article') or soup

        # استخراج العنوان الصحيح من داخل محتوى المقال وتجنب الهيدر
        title_el = content_box.find(['h1', 'h2']) if content_box else None
        if not title_el:
            title_el = soup.find('h1', class_=re.compile(r'(entry-title|post-title|chapter-title)'))
        
        title = title_el.text.strip() if title_el else f"الفصل {chapter_num}"
        if "مظهر الموقع" in title or "الحساب" in title:
            title = f"الفصل {chapter_num}"

        clean_text = clean_content(content_box)

        data = {
            "novel_id": novel_id,
            "chapter_number": chapter_num,
            "title": title,
            "content": clean_text
        }
        
        # استخدام upsert لتحديث البيانات القديمة الخاطئة
        supabase.table("chapters").upsert(data, on_conflict="novel_id,chapter_number").execute()
        print(f"✅ تم تحديث/حفظ الفصل {chapter_num}: {title}")

    except Exception as e:
        print(f"❌ خطأ أثناء حفظ الفصل {chapter_num}: {e}")

def process_novel_chapters(novel_id, novel_url):
    print(f"\n🔍 فحص الفصول من: {novel_url}")
    try:
        res = requests.get(novel_url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(res.text, 'html.parser')
        
        # استخراج عنوان الرواية من صفحة الرواية الرئيسية
        novel_title = soup.find('h1', class_=re.compile(r'(entry-title|post-title|novel-title)'))
        if not novel_title:
            novel_title = soup.find(['h1', 'h2'])
        
        novel_title_text = novel_title.text.strip() if novel_title else "Solo Leveling"
        if "مظهر الموقع" in novel_title_text:
            novel_title_text = "Solo Leveling"
            
        ensure_novel_exists(novel_id, novel_title_text)

        chapter_links = []
        ignored_paths = ['/category/', '/tag/', '/privacy-policy/', '/contact/', '/about/', '/manga/']
        
        for a in soup.find_all('a', href=True):
            full_url = urljoin(novel_url, a['href'])
            if "cenele.com" in full_url and full_url.strip('/') != novel_url.strip('/'):
                if not any(path in full_url for path in ignored_paths):
                    if full_url not in chapter_links:
                        chapter_links.append(full_url)

        print(f"📊 تم العثور على {len(chapter_links)} رابط فصل.")

        for index, url in enumerate(chapter_links, start=1):
            match = re.search(r'(\d+)', url.replace('https://cenele.com/', ''))
            ch_num = int(match.group(1)) if match else index
            fetch_and_save_chapter(novel_id, ch_num, url)

    except Exception as e:
        print(f"❌ خطأ أثناء قراءة الرواية: {e}")

if __name__ == "__main__":
    TARGET_NOVELS = [
        {"id": "b3009d79-80f1-4dbc-8081-fa4c356ec2b1", "url": "https://cenele.com/levels/"}
    ]
    for novel in TARGET_NOVELS:
        process_novel_chapters(novel["id"], novel["url"])
