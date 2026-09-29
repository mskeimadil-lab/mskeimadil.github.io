import os
import re
import time
import requests
from bs4 import BeautifulSoup

print("=== بدء السحب والحفظ في جيت هاب ===")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://cenele.com/"
}

os.makedirs("data", exist_ok=True)

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

def process_chapter(chapter_url, novel_title, chapter_idx):
    try:
        res = requests.get(chapter_url, headers=HEADERS, timeout=15)
        if res.status_code != 200: return
        soup = BeautifulSoup(res.text, 'html.parser')
        content_box = soup.find('div', class_=re.compile(r'text-left|entry-content|reading-content|epcontent|chapter-content', re.I)) or soup.find('article')
        
        if content_box:
            title_elem = soup.find('h1') or soup.find('h2')
            title = title_elem.get_text().strip() if title_elem else f"Chapter {chapter_idx}"
            cleaned = clean_text(content_box)
            
            if cleaned:
                safe_novel_title = re.sub(r'[\\/*?:"<>|]', "", novel_title).strip()
                safe_chapter_title = re.sub(r'[\\/*?:"<>|]', "", title).strip()
                
                novel_dir = os.path.join("data", safe_novel_title)
                os.makedirs(novel_dir, exist_ok=True)
                
                file_path = os.path.join(novel_dir, f"{safe_chapter_title}.txt")
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(f"{title}\n\n{cleaned}")
                print(f"✓ تم حفظ: {title}")
    except Exception as e:
        print(f"خطأ أثناء الحفظ: {e}")

def main():
    novels = get_novel_links()
    # وضعنا حد روايتين و 5 فصول للتجربة السريعة فقط. 
    for idx, novel_url in enumerate(novels[:2], 1): 
        novel_title = novel_url.strip('/').split('/')[-1].replace('-', ' ').title()
        print(f"\n[{idx}/{len(novels[:2])}] معالجة: {novel_title}")
        
        chapters = get_chapter_links(novel_url)
        for c_idx, chapter in enumerate(chapters[:5], 1):
            process_chapter(chapter, novel_title, c_idx)
            time.sleep(1)

if __name__ == '__main__':
    main()

