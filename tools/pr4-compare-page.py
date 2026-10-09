# Builds docs/handoff/consistency/pr4-headers-compare.html: owner header pictures beside the build's reference pictures (header + 60px of page), self-contained. Run from the repo root: python -I tools/pr4-compare-page.py [scratch folder for the crops and an optional extra.html]
import base64, io, os, subprocess, sys
from PIL import Image

OWN = 'docs/handoff/consistency/headers/'
REF = 'tests/reference/'
OUT = 'docs/handoff/consistency/pr4-headers-compare.html'
INK = (0x1c, 0x22, 0x40)


def ink_groups(im, thr=0.9, ymax=None):
    im = im.convert('RGB'); W, H = im.size; px = im.load(); xs = range(W // 8, W - W // 8, 3); g = []
    for y in range(ymax or H):
        n = sum(1 for x in xs if all(abs(a - b) < 45 for a, b in zip(px[x, y], INK)))
        if n / len(xs) > thr:
            if g and y - g[-1][1] <= 2: g[-1][1] = y
            else: g.append([y, y])
    return g


def uri(im):
    b = io.BytesIO(); im.convert('RGB').save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def owner_crop(file, block=None):
    """block = index of the (top, rule, bottom) triple in a stacked picture; None = the whole frame."""
    im = Image.open(OWN + file).convert('RGB'); g = ink_groups(im)
    if block is None: top, bot = g[0][0], g[-1][1]
    else: top, bot = g[3 * block][0], g[3 * block + 2][1]
    im = im.crop((8, top - 4, im.width - 8, bot + 6))
    return im.resize((im.width // 2, im.height // 2), Image.LANCZOS)


def build_crop(name, extra=60):
    im = Image.open(REF + name).convert('RGB')
    g = [x for x in ink_groups(im, 0.85, 400) if x[0] >= 40]
    return im.crop((0, 0, im.width, g[0][1] + 2 + extra))


def top_crop(im, n):
    return im.convert('RGB').crop((0, 0, im.width, min(n, im.height)))


def old_ref(name):
    data = subprocess.run(['git', 'show', 'HEAD~1:tests/reference/' + name], capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(data))


STD = {'today': 0, 'week': 1, 'preview': 2, 'day': 3}
STD_PHONE = {'today': 0, 'week': 1, 'day': 2}
BUILD = {'today': 'today-jenn', 'week': 'week-full-jenn', 'day': 'day-jenn', 'money': 'mymoney-jenn',
         'meeting': 'meeting-money-jenn-parent', 'preview': 'week-print-preview-jenn'}
TITLE = {'today': 'Today', 'week': 'Week', 'day': 'Day', 'money': 'Money (My money)', 'meeting': 'Meeting', 'preview': 'Week preview'}
LOOK = {'pop': 'Pop', 'calm': 'Calm'}
SIZE = {'ipad': 'iPad', 'phone': 'Phone'}
cache = {}


def owner(screen, size, look):
    k = ('o', screen, size, look)
    if k not in cache:
        if screen in ('today', 'week', 'day', 'preview'):
            cache[k] = owner_crop(f'standard-{size}-{look}.png', (STD if size == 'ipad' else STD_PHONE)[screen])
        else:
            cache[k] = owner_crop(f'{"money" if screen == "money" else "meeting"}-{size}-{look}.png')
    return cache[k]


def build(screen, size, look, who=None):
    name = f'{who or BUILD[screen]}-{size}-{look}.png'
    k = ('b', name)
    if k not in cache:
        cache[k] = build_crop(name, 130 if (screen == 'preview' and size == 'phone') else 60)
    return cache[k]


def fig(cap, im, z):
    return f'<figure><figcaption>{cap}</figcaption><img src="{uri(im)}" width="{round(im.width * z)}" height="{round(im.height * z)}" alt="{cap}"></figure>'


def pair(screen, size, look, h=3, label=None):
    z = 0.72 if size == 'ipad' else 1
    t = label or f'{TITLE[screen]} · {SIZE[size]} · {LOOK[look]}'
    return f'<section><h{h}>{t}</h{h}><div class="pair">{fig("Owner picture", owner(screen, size, look), z)}{fig("Build", build(screen, size, look), z)}</div></section>'


def solo(screen, size, look, note='', who=None, h=3, label=None):
    z = 0.72 if size == 'ipad' else 1
    t = label or f'{TITLE[screen]} · {SIZE[size]} · {LOOK[look]}'
    return f'<section><h{h}>{t}</h{h}><div class="pair">{fig("Build (no owner picture)", build(screen, size, look, who), z)}<p class="box">{note}</p></div></section>'


def before_after(name, n, h=3):
    z = 0.72 if 'ipad' in name else 1
    o = old_ref(name); nw = Image.open(REF + name)
    return (f'<section><h{h}>{name[:-4]}</h{h}><div class="pair">{fig(f"Before ({o.height}px tall)", top_crop(o, n), z)}'
            f'{fig(f"After ({nw.height}px tall)", top_crop(nw, n), z)}</div></section>')


css = '''body{font:16px/1.45 system-ui,sans-serif;margin:0 auto;max-width:1800px;padding:16px;background:#f6f4ef;color:#1c2240}
h1{font-size:24px} h2{margin-top:40px;border-bottom:2px solid #1c2240} h3{margin:22px 0 6px;font-size:17px} h4{margin:18px 0 4px;font-size:15px}
.pair{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
figure{margin:0;background:#fff;border:1px solid #ccc;padding:6px} figcaption{font-size:13px;color:#555;margin-bottom:4px}
img{display:block;max-width:100%;height:auto}
.rec{font-weight:600;background:#fff4c2;display:inline-block;padding:2px 8px;border-radius:4px}
.q{font-size:12px;background:#c1121f;color:#fff;border-radius:4px;padding:1px 6px;vertical-align:middle}
.box{color:#555;font-size:14px;max-width:420px} .diff{border-bottom:1px solid #ddd;padding-bottom:12px}
table{border-collapse:collapse;background:#fff} td,th{border:1px solid #bbb;padding:3px 10px;text-align:left}'''


def pairs_row(screen, size, looks=('pop', 'calm'), who=None):
    return '<div class="pair">' + ''.join(fig(f'Owner · {LOOK[l]}', owner(screen, size, l), 1) + fig(f'Build · {LOOK[l]}', build(screen, size, l, who), 1) for l in looks) + '</div>'


parts = []
add = parts.append
add(f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PR 4 headers: your pictures beside the build</title><style>{css}</style></head><body>')
add('<h1>PR 4: the new headers, your pictures beside the build</h1>')
add('<p>Build: branch claude/consistency-4 @ 0092928; pictures from CI run 37998019388. The picture test clock is Wednesday 7 October, so dates differ from your pictures (yours say Tuesday 6 October); that is not a difference. Your pictures are drawn 1210 px wide on the iPad and 406 on the phone, the build 1194 and 390; both are shown here at the same scale.</p>')
add('<p><a href="#A">Part A: each header</a> · <a href="#B">Part B: remaining differences</a> · <a href="#C">Part C: pictures that change below the header</a></p>')
add('<h2 id="A">Part A: each header, your picture and the build</h2>')
for size in ('ipad', 'phone'):
    for look in ('pop', 'calm'):
        add(f'<h3>{SIZE[size]} · {LOOK[look]}</h3>')
        for s in ('today', 'week', 'day', 'money', 'meeting'):
            add(pair(s, size, look, 4))
add('<h3>Week preview</h3>')
for look in ('pop', 'calm'):
    add(pair('preview', 'ipad', look, 4))
for look in ('pop', 'calm'):
    add(solo('preview', 'phone', look, 'You drew no phone preview. Your decision: the header is the phone Week header with one 📋 button (back to Full) and Print at the top of the page. The picture is cut 130px below the bar to show the Print row.', h=4))
add('<h3>Sister Sync and Print (you drew no picture; they follow Today)</h3>')
for s, who in (('Sister Sync', 'sync-jenn'), ('Print', 'print-jenn')):
    for size in ('ipad', 'phone'):
        for look in ('pop', 'calm'):
            add(solo('today', size, look, '', who, 4, f'{s} · {SIZE[size]} · {LOOK[look]}'))

add('<h2 id="B">Part B: what still differs from your pictures</h2>')
add('<p>Five numbered items from your table notes, then anything else the pairs show. Pictures exist only at 390 wide on the phone; the narrow sizes (360, 375) are measured numbers, not pictures.</p>')
add('<div class="diff"><h3>1. Phone Week: the week sits between the arrows, not in the middle of the bar</h3>'
    '<p>Same as your picture: with one button left of the week and three right (▶, 🖨, badge) there is no room to centre it. Measured at 390: the week text is centred between ◀ and ▶ to within 1.5px, and 58px left of the bar middle (195). Your picture is 62px left of its middle (202, at 406 wide). Centring it would leave about 22px for the week text, which needs about 85px. Decided as the picture.</p>'
    + pairs_row('week', 'phone') + '</div>')
add('<div class="diff"><h3>2. Phone meeting: gaps are 4px, not 6px</h3>'
    '<p>Row 1 holds two girls (52 + 52), the steps (146) and two buttons (52 + 52): 110 + 6 + 146 + 6 + 110 = 378px, but a 390 phone has 370 inside its 10px padding. At 4px it is exactly 370 and the steps stay in the middle. <b>You accepted this</b>; the 🔊 Sound button stays.</p>'
    + pairs_row('meeting', 'phone') + '</div>')
add('<div class="diff"><h3>3. Narrow phones: some text sizes step down by width</h3>'
    '<p>At 390 and wider the text is as in your picture. On narrower phones the text that does not fit gets the largest half-pixel size that does, in steps (<b>you decided</b>; measured with tools/header-fit-sizes.js). Room between the arrows: 108px at 360, 123 at 375, 138 at 390; the Money switch: 170, 185, 200.</p>'
    '<table><tr><th>Text</th><th>Look</th><th>Size by phone width</th></tr>'
    '<tr><td>Day date (note 5)</td><td>Pop</td><td>20px everywhere</td></tr>'
    '<tr><td></td><td>Calm</td><td>17.5px up to 374; 20px from 375</td></tr>'
    '<tr><td>Two-month week, e.g. "Sep 28 – Oct 4" (note 6)</td><td>Pop</td><td>19.5px up to 360; 20px from 361</td></tr>'
    '<tr><td></td><td>Calm</td><td>14px up to 374; 16px up to 389; 18px up to 401; 20px from 402</td></tr>'
    '<tr><td>"Money school" in the selected tab (note 7)</td><td>Pop</td><td>17px up to 363; 18px from 364</td></tr>'
    '<tr><td></td><td>Calm</td><td>13px up to 374; 14.5px up to 389; 16.5px up to 400; 18px from 401</td></tr>'
    '<tr><td>One-month week; "My money" tab</td><td>both</td><td>20px / 18px everywhere</td></tr></table>'
    '<p class="box">Picture at 390 (no narrower picture exists): Calm Day, the size equals your picture at 390.</p>'
    '<div class="pair">' + fig('Owner · Calm', owner('day', 'phone', 'calm'), 1) + fig('Build · Calm (390)', build('day', 'phone', 'calm'), 1) + '</div></div>')
add('<div class="diff"><h3>4. Phone Week preview: the layout you decided</h3>'
    '<p>You drew no phone preview. <b>You decided</b>: the phone Week header with ◀ week ▶, one 📋 button (52×52, goes back to Full) and the badge; no 🖨 and no Print in the bar. Print is a 52px button at the top of the page (that is why these pictures are 60px taller). The iPad keeps Print in its header. Shown: Full (yours and the build), then the preview (build only).</p>'
    '<div class="pair">' + ''.join(fig(f'Owner Full · {LOOK[l]}', owner('week', 'phone', l), 1) + fig(f'Build Full · {LOOK[l]}', build('week', 'phone', l), 1) + fig(f'Build Preview · {LOOK[l]}', build('preview', 'phone', l), 1) for l in ('pop', 'calm')) + '</div></div>')
add('<div class="diff"><h3>5. Calm phone Money school: 13px at 360 wide <span class="q">question</span></h3>'
    '<p>At 360 the Calm "🎓 Money school" name has 170px of switch. Exactly fitting is 12.5px; the build uses <b>13px</b>, the kids\' text floor, which makes the switch content 1px wider than its frame (167 in 166px; the name itself is not cut; the check allows 1px). At 375 it is 14.5px and at 390 16.5px (picture below, 390). <span class="rec">Recommendation: keep 13px.</span> Do you agree?</p>'
    '<div class="pair">' + fig('Owner · My money, Calm', owner('money', 'phone', 'calm'), 1) + fig('Build · Money school, Calm (390)', build('money', 'phone', 'calm', 'moneyschool-jenn'), 1) + '</div></div>')

def two(screen, size, look):
    z = 0.72 if size == 'ipad' else 1
    return '<div class="pair">' + fig('Owner picture', owner(screen, size, look), z) + fig('Build', build(screen, size, look), z) + '</div>'


Q = ' <span class="q">question</span>'
extra = [
    f'<div class="diff"><h3>6. Day back button: it says "Today" in the build, "Week" in your picture{Q}</h3>'
    '<p>The iPad Day back button names the screen she came from. The picture test opens Day from Today, so it reads "◀ Today"; from Week it reads "◀ Week" as yours. On the phone your picture shows the word "Week" alone; the build shows only ◀ (the table marks this as kept). <span class="rec">Recommendation: keep; the iPad word follows where she came from.</span></p>'
    + two('day', 'ipad', 'pop') + two('day', 'phone', 'pop') + '</div>',
    f'<div class="diff"><h3>7. Family meeting on the iPad: the steps sit in the exact middle, and there is a 🔊 button{Q}</h3>'
    '<p>Your picture has the steps (The week · The money · Close) right of the middle, and one 🗣️ button. The build puts the steps in the exact middle of the bar (the centre rule) and keeps the 🔊 Sound button beside 🗣️ (kept on the phone by your answer to difference 2; the iPad has it too). <span class="rec">Recommendation: keep both.</span></p>'
    + two('meeting', 'ipad', 'pop') + '</div>',
    f'<div class="diff"><h3>8. Meeting row 2 shows a different step{Q}</h3>'
    '<p>Your picture has "✓ Guess" done and Payday highlighted. The picture test opens the meeting at the Guess step, so Guess is highlighted and there is no tick. This is the page state, not the header. <span class="rec">Recommendation: nothing to change.</span></p>'
    + two('meeting', 'phone', 'calm') + '</div>',
    f'<div class="diff"><h3>9. Print page: the header does not reach the top and sides{Q}</h3>'
    '<p>Your table says Print follows Today. In the build the Print Week header starts about 16px down the page and its bottom line stops about 16px short of each side. Today\'s bar is edge to edge. <span class="rec">Recommendation: ask whether Print should be full width like Today.</span></p>'
    + solo('today', 'ipad', 'pop', '', 'print-jenn', 4, 'Print · iPad · Pop (build only)') + '</div>',
    f'<div class="diff"><h3>10. The little pictures (emoji) look different{Q}</h3>'
    '<p>Your pictures were drawn with another emoji set: the chick, 📋, 🖨, 📑, 🗣️, 💰 and 🎓 have other colours and outlines (for example the 📋 on the yellow cell is pale in the build, and 🗣️ is blue, not dark grey). The sizes and places match. The build uses the phone\'s own emoji, so on a real iPad or phone they look like the device\'s set. <span class="rec">Recommendation: nothing to change.</span></p>'
    + two('week', 'ipad', 'pop') + '</div>',
]
add(''.join(extra))

add('<h2 id="C">Part C: pictures that change below the header</h2>')
add('<p>These pictures changed because of what sits under or beside the header, not the header row itself. Before = the reference at HEAD~1, after = now.</p>')
add('<h3>Phone week print preview (Print row added at the top of the page; page 60px taller). Cut at 330px.</h3>')
for who in ('jenn', 'jess'):
    for look in ('pop', 'calm'):
        add(before_after(f'week-print-preview-{who}-phone-{look}.png', 330, 4))
add('<h3>Parent mode: the header sits under the Parent Mode banner (cut at the top 300px iPad, 420px phone)</h3>')
for base in ('day-parent', 'week-full-parent', 'mymoney-parent'):
    for size in ('ipad', 'phone'):
        for look in ('pop', 'calm'):
            add(before_after(f'{base}-{size}-{look}.png', 300 if size == 'ipad' else 420, 4))
add('</body></html>')
html = '\n'.join(parts)
extra = (sys.argv[1] + '/extra.html') if len(sys.argv) > 1 else ''
html = html.replace('<!--EXTRA-->', open(extra, encoding='utf8').read() if extra and os.path.exists(extra) else '')
open(OUT, 'w', encoding='utf8').write(html)
print(OUT, round(len(html.encode()) / 1e6, 2), 'MB')
if len(sys.argv) > 1:
    for k, v in cache.items():
        v.save(sys.argv[1] + '/' + '_'.join(k) + '.png')
