import urllib.request
import urllib.parse
import re

query = 'kitkat chocolates'
req = urllib.request.Request(
    'https://html.duckduckgo.com/html/?q=' + urllib.parse.quote(query + ' images'), 
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
)
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    images = re.findall(r'<img.*?src="(//external-content\.duckduckgo\.com/iu/\?u=.*?)"', html)
    print(images[:3])
except Exception as e:
    print(e)
