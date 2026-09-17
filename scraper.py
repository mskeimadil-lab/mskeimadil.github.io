import os
import re
import time
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client

# إعدادات Supabase
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

def clean_text(content_box):
    """تنظيف النص من جميع الإعلانات والشوائب والروابط الخبيثة"""
    if not content_box:
        return ""

    # حذف العناصر غير المرغوبة
    for junk in content_box.find_all(['script', 'style', 'iframe', 'form', 'table', 'button', 'ul', 'ol', 'ins', 'a']):
        junk.decompose()

    # حذف الفئات الإعلانية الخاصة بموقع cenele
    for junk_class in content_box.find_all(class_=re.compile(r'ad|banner|donate|vip|app|notice|share|download|code-block', re.I)):
        junk_class.decompose()

    text = content_box.get_text(separator='\n')

    # عبارات التبرع والإعلانات الشائعة للتنظيف
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
        r'cenele\.com',
        r'المترجم\s*:.*',
        r'تاريخ النشر\s*:.*',
        r'عدد الكلمات\s*:.*'
    ]

    for pattern in patterns_to_remove:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)

    lines = [line.strip() for line in text.split('\n') if line.strip()]
    return '\n\n'.join(lines)

def fetch_cenele_chapter(chapter_url):
    """جلب وتنظيف محتوى فصل من موقع Cenele"""
    try:
        response = requests.get(chapter_url, headers=HEADERS, timeout=15)
        if response.status_code != 200:
            print(f"فشل جلب الصفحة {chapter_url} - كود الحالة: {response.status_code}")
            return None

        soup = BeautifulSoup(response.text, 'html.parser')

        # محددات النص الخاصة بموقع Cenele والمواقع المشابهة
        content_box = soup.find('div', class_=re.compile(r'text-left|entry-content|reading-content|epcontent|chapter-content', re.I))
        
        if not content_box:
            content_box = soup.find('article') or soup.find('main')

        if content_box:
            title_elem = soup.find('h1') or soup.find('h2')
            title = title_elem.get_text().strip() if title_elem else "فصل بدون عنوان"
            cleaned_body = clean_text(content_box)
            return {"title": title, "content": cleaned_body, "url": chapter_url}
        else:
            print(f"لم يتم العثور على حاوي النص في: {chapter_url}")
            return None

    except Exception as e:
        print(f"خطأ أثناء معالجة الرابط {chapter_url}: {e}")
        return None

def main():
    print("بدء عملية سحب الفصول من موقع Cenele...")

    # قائمة بالروابط أو الرواية المراد سحبها من Cenele
    # استبدل هذه الروابط بروابط الفصول أو أضف دالة جلب قائمة الفصول
    target_chapters = [
        # مثال: "https://cenele.com/novel-name/chapter-1/"
    ]

    for url in target_chapters:
        print(f"جاري معالجة: {url}")
        data = fetch_cenele_chapter(url)
        if data and data['content']:
            # حفظ البيانات في جدول 'chapters' داخل Supabase
            try:
                supabase.table('chapters').upsert({
                    'title': data['title'],
                    'content': data['content'],
                    'source_url': data['url']
                }).execute()
                print(f"تم حفظ الفصل بنجاح: {data['title']}")
            except Exception as sb_err:
                print(f"خطأ أثناء الحفظ في Supabase: {sb_err}")

        time.sleep(2) # فترة توقف لتجنب حظر IP

    print("انتهت عملية السحب والتنظيف.")

if __name__ == '__main__':
    main()

