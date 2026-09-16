import os
import re
import uuid
import requests
from bs4 import BeautifulSoup
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

BAD_WORDS = [
    "Skip Ad", "ارتق بتجربتك", "VIP", "فضاء الروايات", 
    "تحميل التطبيق", "انضم إلى سيرفر", "تليجرام", "Sign in"
]

def clean_text(soup_obj):
    # إزالة الأزرار والإعلانات المنبثقة والنصوص الترويجية
    for tag in soup_obj.find_all(['script', 'style', 'iframe', 'button', 'form', 'a']):
        if any(bad in tag.text for bad in BAD_WORDS) or 'ad' in tag.get('class', []):
            tag.decompose()
            
    text = soup_obj.get_text(separator='\n')
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    cleaned = '\n\n'.join(lines)
    
    for word in BAD_WORDS:
        cleaned = re.sub(rf'.*{re.escape(word)}.*', '', cleaned)
    return cleaned.strip()

def fetch_auto_novels():
    """جلب قائمة الروايات تلقائياً من صفحة المكتبة"""
    url = "https://cenele.com/cont/"
    try:
        res = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(res.text, 'html.parser')
        novels = []
        for a in soup.find_all('a', href=True):
            href = a['href']
            if '/cont/' in href and href.strip('/') != 'https://cenele.com/cont':
                full_url = href if href.startswith('http') else f"https://cenele.com{href}"
                # توليد UUID ثابت وفريد بناءً على رابط الرواية
                n_id = str(uuid.uuid5(uuid.NAMESPACE_URL, full_url))
                if not any(n['url'] == full_url for n in novels):
                    novels.append({'id': n_id, 'url': full_url})
        return novels
    except Exception as e:
        print(f"❌ خطأ في جلب قائمة الروايات: {e}")
        return []

def process_novel(novel_id, novel_url):
    try:
        res = requests.get(novel_url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(res.text, 'html.parser')
        
        title_el = soup.find('h1') or soup.find('title')
        novel_title = title_el.text.strip() if title_el else "رواية جديدة"
        for bad in BAD_WORDS:
            novel_title = novel_title.replace(bad, '').strip()

        # إضافة الرواية لقاعدة البيانات إن لم تكن موجودة
        supabase.table('novels').upsert({'id': novel_id, 'title': novel_title}).execute()

        # استخراج كافة روابط الفصول
        chapter_links = []
        for a in soup.find_all('a', href=True):
            full_url = a['href'] if a['href'].startswith('http') else f"https://cenele.com{a['href']}"
            match = re.search(r'/(\d+)/?$', full_url)
            if match and full_url not in chapter_links:
                chapter_links.append((int(match.group(1)), full_url))

        # ترتيب الفصول تصاعدياً
        chapter_links.sort(key=lambda x: x[0])

        for ch_num, ch_url in chapter_links:
            ch_res = requests.get(ch_url, headers=HEADERS, timeout=15)
            ch_soup = BeautifulSoup(ch_res.text, 'html.parser')
            
            content_box = ch_soup.find('div', class_=re.compile(r'entry-content|chapter-content|reading-content')) or ch_soup.find('article')
            if not content_box:
                continue

            cleaned_content = clean_text(content_box)
            
            supabase.table('chapters').upsert({
                'novel_id': novel_id,
                'chapter_number': ch_num,
                'title': f"الفصل {ch_num}",
                'content': cleaned_content
            }).execute()
            print(f"✓ تم حفظ الفصل {ch_num} للرواية: {novel_title}")

    except Exception as e:
        print(f"❌ خطأ أثناء معالجة الرواية {novel_url}: {e}")

if __name__ == "__main__":
    target_novels = fetch_auto_novels()
    print(f"📚 تم العثور على {len(target_novels)} رواية.")
    for novel in target_novels:
        process_novel(novel['id'], novel['url'])

