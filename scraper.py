import os
import re
import time
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client

print("=== بدء خط السحب والتنظيف الشامل ===")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("خطأ: لم يتم العثور على مفاتيح Supabase.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://cenele.com/"
}

def clean_text(content_box):
    if not content_box:
        return ""
    for junk in content_box.find_all(['script', 'style', 'iframe', 'form', 'table', 'button', 'ul', 'ol', 'ins', 'a']):
        junk.decompose()
    for junk_class in content_box.find_all(class_=re.compile(r'ad|banner|donate|vip|app|notice|share|download|code-block', re.I)):
        junk_class.decompose()
        
    text = content_box.get_text(separator='\n')
    patterns = [
        r'دعم .* لزيادة تنزيل الفصول.*', r'أنواع التبرعات المتوفرة.*', r'تنزيل \d+ فصول?.*', 
        r'USD \d+\.\d+\$?', r'حمل التطبيق لقراءة أسرع.*', r'حمله من هنا من جوجل بلاي.*', 
        r'Google Play', r'تجربة قراءة أفضل مع.*', r'تصفح الموقع والتطبيق بدون إعلانات.*', 
        r'تحميل الفصول وقراءتها بدون إنترنت.*', r'cenele\.com', r'المترجم\s*:.*', 
        r'تاريخ النشر\s*:.*', r'عدد الكلمات\s*:.*'
    ]
    for p in patterns:
        text = re.sub(p, '', text, flags=re.IGNORECASE)
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    return '\n\n'.join(lines)

def get_novel_links():
    url = "https://cenele.com/"
    novels = []
    try:
        res = requests.get(url, headers=HEADERS, timeout=15)
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, 'html.parser')
            for a in soup.find_all('a', href=True):
                href = a['href']
                if ('/series/' in href or '/novel/' in href) and href not in novels:
                    full_url = href if href.startswith('http') else f"https://cenele.com{href}"
                    novels.append(full_url)
    except Exception as e:
        print(f"خطأ جلب الروايات: {e}")
    return novels

def get_chapter_links(novel_url):
    chapters = []
    try:
        res = requests.get(novel_url, headers=HEADERS, timeout=15)
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, 'html.parser')
            for a in soup.find_all('a', href=True):
                href = a['href']
                if ('/chapter-' in href or re.search(r'-\d+/$', href)) and href not in chapters:
                    full_url = href if href.startswith('http') else f"https://cenele.com{href}"
                    chapters.append(full_url)
    except Exception as e:
        print(f"خطأ جلب الفصول: {e}")
    return chapters

def get_or_create_novel(novel_url):
    """جلب معرّف الرواية أو إنشاؤها في جدول novels لربطها بالفصول"""
    slug = novel_url.strip('/').split('/')[-1]
    title = slug.replace('-', ' ').title()
    try:
        # البحث عن الرواية
        res = supabase.table('novels').select('id').ilike('title', f"%{title}%").limit(1).execute()
        if res.data:
            return res.data[0]['id']
        # إنشاؤها إن لم تكن موجودة
        insert_res = supabase.table('novels').insert({'title': title}).execute()
        if insert_res.data:
            return insert_res.data[0]['id']
    except Exception as e:
        print(f"تنبيه: خطأ في جدول novels: {e}")
    return None

def process_chapter(chapter_url, novel_id):
    try:
        res = requests.get(chapter_url, headers=HEADERS, timeout=15)
        if res.status_code != 200: return
        soup = BeautifulSoup(res.text, 'html.parser')
        content_box = soup.find('div', class_=re.compile(r'text-left|entry-content|reading-content|epcontent|chapter-content', re.I)) or soup.find('article')
        
        if content_box:
            title_elem = soup.find('h1') or soup.find('h2')
            title = title_elem.get_text().strip() if title_elem else "فصل بدون عنوان"
            cleaned = clean_text(content_box)
            
            if cleaned:
                payload = {
                    'title': title,
                    'content': cleaned,
                    'source_url': chapter_url
                }
                # إضافة المعرّف إذا وُجد لتفادي رفض قاعدة البيانات
                if novel_id:
                    payload['novel_id'] = novel_id
                    
                supabase.table('chapters').upsert(payload).execute()
                print(f"✓ تم الحفظ: {title}")
    except Exception as e:
        print(f"خطأ أثناء الحفظ في قاعدة البيانات: {e}")

def main():
    novels = get_novel_links()
    print(f"تم اكتشاف {len(novels)} رواية.")
    for idx, novel in enumerate(novels, 1):
        print(f"\n[{idx}/{len(novels)}] معالجة: {novel}")
        novel_id = get_or_create_novel(novel)
        
        chapters = get_chapter_links(novel)
        for chapter in chapters:
            process_chapter(chapter, novel_id)
            time.sleep(1)

if __name__ == '__main__':
    main()

