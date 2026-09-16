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

        chapter_map = {}
        for a in soup.find_all('a', href=True):
            raw_url = a['href']
            full_url = raw_url if raw_url.startswith('http') else f"https://cenele.com{raw_url}"
            decoded_url = urllib.parse.unquote(full_url)
            
            match = re.search(r'الفصل[-\s_]?(\d+)', decoded_url)
            if match:
                ch_num = int(match.group(1))
                chapter_map[ch_num] = full_url

        if not chapter_map:
            print(f"⚠️ لم يتم العثور على فصول لـ {novel_title}")
            return

        sorted_nums = sorted(chapter_map.keys())
        
        # البدء من أوّل فصل والتتبع بالتتابع عبر رابط "الفصل التالي"
        current_ch_num = sorted_nums[0]
        current_url = chapter_map[current_ch_num]
        visited = set()

        while current_url and current_url not in visited:
            visited.add(current_url)

            try:
                ch_res = requests.get(current_url, headers=HEADERS, timeout=15)
                ch_soup = BeautifulSoup(ch_res.text, 'html.parser')
                
                decoded_curr = urllib.parse.unquote(current_url)
                match = re.search(r'الفصل[-\s_]?(\d+)', decoded_curr)
                if match:
                    current_ch_num = int(match.group(1))

                content_box = (
                    ch_soup.find('div', class_=re.compile(r'entry-content|chapter-content|reading-content|reading-container|epcontent|content', re.I)) 
                    or ch_soup.find('article')
                    or ch_soup.body
                )

                cleaned_content = clean_text(content_box)
                if cleaned_content:
                    supabase.table('chapters').upsert({
                        'novel_id': novel_id,
                        'chapter_number': current_ch_num,
                        'title': f"الفصل {current_ch_num}",
                        'content': cleaned_content
                    }).execute()
                    print(f"✓ تم حفظ الفصل {current_ch_num} للرواية: {novel_title}")

                # البحث عن رابط "التالي" للانتقال التراتبي
                next_url = None
                for a in ch_soup.find_all('a', href=True):
                    txt = a.text.strip()
                    href = a['href']
                    full_next = href if href.startswith('http') else f"https://cenele.com{href}"
                    
                    if ('التالي' in txt or 'next' in txt.lower()) and 'الفصل' in urllib.parse.unquote(full_next):
                        next_url = full_next
                        break

                if not next_url:
                    higher_nums = [n for n in sorted_nums if n > current_ch_num]
                    if higher_nums:
                        next_url = chapter_map[higher_nums[0]]

                current_url = next_url

            except Exception as ch_e:
                print(f"⚠️ خطأ في معالجة الفصل {current_ch_num}: {ch_e}")
                break

    except Exception as e:
        print(f"❌ خطأ في معالجة الرواية {novel_url}: {e}")

if __name__ == "__main__":
    target_novels = fetch_auto_novels()
    print(f"📚 تم العثور على {len(target_novels)} رواية.")
    for novel in target_novels:
        process_novel(novel['id'], novel['url'])
