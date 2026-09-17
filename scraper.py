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
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def clean_text(content_box):
    if not content_box:
        return ""

    for junk in content_box.find_all(['script', 'style', 'iframe', 'form', 'table', 'button', 'ul', 'ol']):
        junk.decompose()

    for junk_class in content_box.find_all(class_=re.compile(r'ad|banner|donate|vip|app|notice|share|download', re.I)):
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
        r'قاموس شخصي ووضع التركيز.*',
        r'علامة التوثيق وبارج ذهبي.*',
        r'رفع \d+ صورة في التعليقات.*',
        r'تجميع الخبرة أسرع.*',
        r'هذا التطبيق يسرق من موقع.*',
        r'[a-f0-9]{8,12}',
        r'المترجم\s*:.*',
        r'تاريخ النشر\s*:.*',
        r'عدد الكلمات\s*:.*',
        r'المجلد \d+\s*:.*'
    ]

    for pattern in patterns_to_remove:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)

    lines = [line.strip() for line in text.split('\n') if line.strip()]
    return '\n\n'.join(lines)

def scrape_chapter(url):
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # البحث عن حاوي النص الرئيسي للفصل
        content_box = soup.find('div', class_=re.compile(r'content|entry-content|chapter-content|text', re.I))
        if not content_box:
            content_box = soup.find('article') or soup.find('main')
            
        return clean_text(content_box) if content_box else ""
    except Exception as e:
        print(f"خطأ أثناء جلب الفصل {url}: {e}")
        return None

def main():
    print("بدء عملية سحب وتنظيف الفصول...")
    
    # هنا يتم وضع منطق الاستعلام عن الروايات وجلب الفصول وإرسالها إلى Supabase
    # مثال إرسال فصل معالج:
    # cleaned_content = scrape_chapter(chapter_url)
    # supabase.table('chapters').upsert({...}).execute()
    
    print("تمت العملية بنجاح.")

if __name__ == '__main__':
    main()

