import os
import re
import time
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("خطأ: لم يتم العثور على مفاتيح Supabase.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://cenele.com/"
}

# ضع هنا رابط صفحة الرواية الرئيسية من cenele.com
NOVEL_URL = "https://cenele.com/series/example-novel/"

def clean_text(content_box):
    """دالة التنظيف الشاملة للإعلانات والشوائب"""
    if not content_box:
        return ""

    for junk in content_box.find_all(['script', 'style', 'iframe', 'form', 'table', 'button', 'ul', 'ol', 'ins', 'a']):
        junk.decompose()

    for junk_class in content_box.find_all(class_=re.compile(r'ad|banner|donate|vip|app|notice|share|download|code-block', re.I)):
        junk_class.decompose()

    text = content_box.get_text(separator='\n')

    patterns_to_remove = [
        r'دعم .* لزيادة تنزيل الفصول.*',
        r'أنواع التبرعات المتوفرة.*',
        r'تنزيل \d+ فصول?.*',
        r'USD \d+\.\d+\$?',
        r'حمل التطبيق لقراءة أسرع.*',
        r'حمله من هنا من جوجل بلاي.*',
        r'Google Play',
        r'تجربة قراءة أفضل مع.*',
        r'تصفح الموقع والتطبيق بدون إعلانات.*',
        r'تحميل الفصول وقراءتها بدون إنترنت.*',
        r'cenele\.com',
        r'المترجم\s*:.*',
        r'تاريخ النشر\s*:.*',
        r'عدد الكلمات\s*:.*'
    ]

    for pattern in patterns_to_remove:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)

    lines = [line.strip() for line in text.split('\n') if line.strip()]
    return '\n\n'.join(lines)

def get_all_chapter_links(novel_url):
    """استخراج جميع روابط الفصول تلقائياً من صفحة الرواية"""
    try:
        res = requests.get(novel_url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(res.text, 'html.parser')
        links = []
        for a in soup.find_all('a', href=True):
            href = a['href']
            if '/chapter-' in href or re.search(r'/فصل-\d+/', href) or re.search(r'-\d+/$', href):
                if href not in links and href.startswith('http'):
                    links.append(href)
        return links
    except Exception as e:
        print(f"خطأ في جلب روابط الفصول: {e}")
        return []

def scrape_and_save_chapter(chapter_url):
    """جلب الفصل وتنظيفه ثم إرساله إلى Supabase"""
    try:
        res = requests.get(chapter_url, headers=HEADERS, timeout=15)
        if res.status_code != 200:
            return

        soup = BeautifulSoup(res.text, 'html.parser')
        content_box = soup.find('div', class_=re.compile(r'text-left|entry-content|reading-content|epcontent|chapter-content', re.I))
        if not content_box:
            content_box = soup.find('article') or soup.find('main')

        if content_box:
            title_elem = soup.find('h1') or soup.find('h2')
            title = title_elem.get_text().strip() if title_elem else "فصل بدون عنوان"
            cleaned_body = clean_text(content_box)

            if cleaned_body:
                supabase.table('chapters').upsert({
                    'title': title,
                    'content': cleaned_body,
                    'source_url': chapter_url
                }).execute()
                print(f"تم تنظيف وحفظ: {title}")
    except Exception as e:
        print(f"خطأ في معالجة الفصل {chapter_url}: {e}")

def main():
    print("بدء عملية الاستخراج والتنظيف التلقائي...")
    chapter_links = get_all_chapter_links(NOVEL_URL)
    print(f"تم العثور على {len(chapter_links)} فصل.")

    for link in chapter_links:
        scrape_and_save_chapter(link)
        time.sleep(2)

if __name__ == '__main__':
    main()

