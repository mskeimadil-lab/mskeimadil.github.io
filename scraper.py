import os
import re
import time
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client

print("=== بدء تشغيل سكريبت Cenele Scraper ===")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✓ تم الاتصال بـ Supabase بنجاح.")
    except Exception as e:
        print(f"خطأ في الاتصال بـ Supabase: {e}")
else:
    print("تنبيه: مفاتيح Supabase غير معرفة بيئياً (سيتم الفحص بدون حفظ محلي).")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

def main():
    catalog_url = "https://cenele.com/"
    print(f"جاري الاتصال بالموقع: {catalog_url}")
    
    try:
        res = requests.get(catalog_url, headers=HEADERS, timeout=15)
        print(f"استجابة الموقع: {res.status_code}")
        
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, 'html.parser')
            links = []
            for a in soup.find_all('a', href=True):
                href = a['href']
                if ('/series/' in href or '/novel/' in href or '/chapter' in href) and href not in links:
                    links.append(href)
            
            print(f"تم العثور على {len(links)} رابط في الصفحة الرئيسية.")
            
            # معالجة أول رابط كمثال للتأكد
            if links:
                target_url = links[0] if links[0].startswith('http') else f"https://cenele.com{links[0]}"
                print(f"جاري اختبار جلب وتنظيف: {target_url}")
                ch_res = requests.get(target_url, headers=HEADERS, timeout=15)
                ch_soup = BeautifulSoup(ch_res.text, 'html.parser')
                content_box = ch_soup.find('div', class_=re.compile(r'text-left|entry-content|reading-content|epcontent|chapter-content', re.I)) or ch_soup.find('article')
                
                cleaned = clean_text(content_box)
                print(f"طول النص المنظف: {len(cleaned)} حرف.")
                
                if supabase and cleaned:
                    title_elem = ch_soup.find('h1') or ch_soup.find('h2')
                    title = title_elem.get_text().strip() if title_elem else "فصل بدون عنوان"
                    supabase.table('chapters').upsert({
                        'title': title,
                        'content': cleaned,
                        'source_url': target_url
                    }).execute()
                    print(f"✓ تم الحفظ بنجاح في Supabase: {title}")
    except Exception as e:
        print(f"خطأ أثناء التنفيذ: {e}")

if __name__ == '__main__':
    main()

