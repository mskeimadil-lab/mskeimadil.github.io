import os
import re
import time
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

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

def main():
    print("بدء تشغيل سكريبت سحب الروايات...")
    if not supabase:
        print("خطأ: لم يتم ضبط بيانات الاتصال بـ Supabase.")
        return
    print("السكريبت جاهز ومتصل بقاعدة البيانات بنجاح.")

if __name__ == '__main__':
    main()

