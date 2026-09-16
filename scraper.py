import os
import re
import uuid
import requests
import urllib.parse
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
    urls_to_check = ["https://cenele.com/novel/", "https://cenele.com/home/", "https://cenele.com/"]
    novels = []
    
    for url in urls_to_check:
        try:
            res = requests.get(url, headers=HEADERS, timeout=15)
            soup = BeautifulSoup(res.text, 'html.parser')
            
            for a in soup.find_all('a', href=True):
                href = a['href'].strip()
                full_url = href if href.startswith('http') else f"https://cenele.com{href}"
                full_url = full_url.rstrip('/')
                decoded_url = urllib.parse.unquote(full_url)
                
                if ('/cont/' in decoded_url or '/novel/' in decoded_url) and 'الفصل' not in decoded_url:
                    if decoded_url not in ["https://cenele.com/cont", "https://cenele.com/novel"]:
                        n_id = str(uuid.uuid5(uuid.NAMESPACE_URL, full_url))
                        if not any(n['url'] == full_url for n in novels):
                            novels.append({'id': n_id, 'url': full_url})
        except Exception as e:
            print(f"Error checking {url}: {e}")

    if not novels:
        fallback_urls = [
            "https://cenele.com/cont/book-eatin",
            "https://cenele.com/cont/knight-eternally-regresses",
            "https://cenele.com/cont/i-really-villain"
        ]
        for u in fallback_urls:
            novels.append({'id': str(uuid.uuid5(uuid.NAMESPACE_URL, u)), 'url': u})

    return novels

def process_novel(novel_id, novel_url):
    try:
        res = requests.get(novel_url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(res.text, 'html.parser')
        
        title_el = soup.find('h1') or soup.find('title')
        novel_title = title_el.text.strip() if title_el else "رواية جديدة"
        for bad in BAD_WORDS:
            novel_title = novel_title.replace(bad, '').strip()

        print(f"📖 جاري معالجة الرواية: {novel_title}")
        supabase.table('novels').upsert({'id': novel_id, 'title': novel_title}).execute()

        chapter_links = []
        for a in soup.find_all('a', href=True):
            raw_url = a['href']
            full_url = raw_url if raw_url.startswith('http') else f"https://cenele.com{raw_url}"
            decoded_url = urllib.parse.unquote(full_url)
            
            match = re.search(r'الفصل[-\s_]?(\d+)', decoded_url)
            if match:
                ch_num = int(match.group(1))
                if not any(x[1] == full_url for x in chapter_links):
                    chapter_links.append((ch_num, full_url))

        print(f"🔗 عُثر على {len(chapter_links)} فصل للرواية.")
        chapter_links.sort(key=lambda x: x[0])

        for ch_num, ch_url in chapter_links:
            try:
                ch_res = requests.get(ch_url, headers=HEADERS, timeout=15)
                ch_soup = BeautifulSoup(ch_res.text, 'html.parser')
                
                content_box = (
                    ch_soup.find('div', class_=re.compile(r'entry-content|chapter-content|reading-content|reading-container|epcontent|content', re.I)) 
                    or ch_soup.find('article')
                    or ch_soup.body
                )

                cleaned_content = clean_text(content_box)
                if not cleaned_content:
                    continue

                supabase.table('chapters').upsert({
                    'novel_id': novel_id,
                    'chapter_number': ch_num,
                    'title': f"الفصل {ch_num}",
                    'content': cleaned_content
                }).execute()
                print(f"✓ تم حفظ الفصل {ch_num} للرواية: {novel_title}")
            except Exception as ch_e:
                print(f"⚠️ خطأ في معالجة الفصل {ch_num}: {ch_e}")

    except Exception as e:
        print(f"❌ خطأ في معالجة الرواية {novel_url}: {e}")

if __name__ == "__main__":
    target_novels = fetch_auto_novels()
    print(f"📚 تم العثور على {len(target_novels)} رواية.")
    for novel in target_novels:
        process_novel(novel['id'], novel['url'])
