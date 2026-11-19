import os
import math
from PIL import Image, ImageDraw, ImageFont

PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frontend', 'public')
os.makedirs(PUBLIC_DIR, exist_ok=True)

def draw_daily_voice_emblem(draw, center_x, center_y, scale, is_maskable=False):
    # Colors
    c_terracotta = (154, 52, 18, 255)      # #9A3412
    c_rust = (194, 65, 12, 255)            # #C2410C
    c_ivory = (250, 247, 242, 255)         # #FAF7F2
    c_cream = (243, 236, 226, 255)         # #F3ECE2
    c_gold = (217, 119, 6, 255)            # #D97706
    c_charcoal = (28, 25, 23, 255)         # #1C1917

    # Center broadcast radio tower / mast with newspaper broadsheet wings
    # 1. Newspaper sheet background behind radio tower
    sheet_w = 260 * scale
    sheet_h = 320 * scale
    sheet_x0 = center_x - sheet_w / 2
    sheet_y0 = center_y - sheet_h / 2 + 10 * scale
    sheet_x1 = sheet_x0 + sheet_w
    sheet_y1 = sheet_y0 + sheet_h
    
    # White/ivory broadsheet page
    draw.rounded_rectangle(
        [sheet_x0, sheet_y0, sheet_x1, sheet_y1],
        radius=int(24 * scale),
        fill=c_ivory,
        outline=c_cream,
        width=int(4 * scale)
    )

    # Newspaper masthead top bar in broadsheet
    draw.rectangle(
        [sheet_x0 + 20 * scale, sheet_y0 + 24 * scale, sheet_x1 - 20 * scale, sheet_y0 + 44 * scale],
        fill=c_terracotta
    )

    # Broadsheet text rule lines
    line_y = sheet_y0 + 64 * scale
    while line_y < sheet_y1 - 40 * scale:
        draw.line(
            [(sheet_x0 + 24 * scale, line_y), (sheet_x1 - 24 * scale, line_y)],
            fill=(214, 206, 191, 200),
            width=int(3 * scale)
        )
        line_y += 24 * scale

    # 2. Broadsheet fold crease
    draw.line(
        [(center_x, sheet_y0 + 46 * scale), (center_x, sheet_y1 - 10 * scale)],
        fill=(200, 190, 175, 220),
        width=int(2 * scale)
    )

    # 3. Terracotta circular audio badge in front of the broadsheet
    badge_r = 130 * scale
    draw.ellipse(
        [center_x - badge_r, center_y - badge_r + 20 * scale, center_x + badge_r, center_y + badge_r + 20 * scale],
        fill=c_terracotta,
        outline=c_rust,
        width=int(6 * scale)
    )

    # 4. Radio mast / microphone / audio wave emblem inside the badge
    # Radio tower central circle
    dot_r = 18 * scale
    dot_cy = center_y + 20 * scale
    draw.ellipse(
        [center_x - dot_r, dot_cy - dot_r, center_x + dot_r, dot_cy + dot_r],
        fill=c_ivory
    )

    # Radio waves (arcs on left and right)
    arc_widths = [int(7 * scale), int(7 * scale), int(6 * scale)]
    radii = [42 * scale, 72 * scale, 102 * scale]

    for i, r in enumerate(radii):
        w = arc_widths[i]
        bbox = [center_x - r, dot_cy - r, center_x + r, dot_cy + r]
        # Right waves
        draw.arc(bbox, start=-48, end=48, fill=c_ivory, width=w)
        # Left waves
        draw.arc(bbox, start=132, end=228, fill=c_ivory, width=w)

    # Base stand for the radio tower
    draw.line(
        [(center_x, dot_cy + dot_r), (center_x, dot_cy + 52 * scale)],
        fill=c_ivory,
        width=int(8 * scale)
    )
    draw.line(
        [(center_x - 30 * scale, dot_cy + 52 * scale), (center_x + 30 * scale, dot_cy + 52 * scale)],
        fill=c_ivory,
        width=int(8 * scale)
    )

def generate_pwa_icons():
    # 1. Generate 1024x1024 high-res master icon on dark charcoal squircle
    size = 1024
    master_img = Image.new('RGBA', (size, size), (250, 247, 242, 255)) # Ivory background
    draw = ImageDraw.Draw(master_img)

    # Outer squircle
    margin = 48
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=220,
        fill=(28, 25, 23, 255),
        outline=(46, 42, 39, 255),
        width=12
    )
    draw_daily_voice_emblem(draw, size // 2, size // 2, scale=1.5, is_maskable=False)

    # Save 512x512 standard
    icon_512 = master_img.resize((512, 512), Image.Resampling.LANCZOS)
    icon_512.save(os.path.join(PUBLIC_DIR, 'icon-512.png'), 'PNG')
    print("Generated icon-512.png")

    # Save 192x192 standard
    icon_192 = master_img.resize((192, 192), Image.Resampling.LANCZOS)
    icon_192.save(os.path.join(PUBLIC_DIR, 'icon-192.png'), 'PNG')
    print("Generated icon-192.png")

    # 2. Generate maskable icon (full-bleed solid background, content inside 80% safe circle)
    maskable_img = Image.new('RGBA', (size, size), (28, 25, 23, 255)) # Solid charcoal
    draw_maskable = ImageDraw.Draw(maskable_img)
    # Scale slightly smaller (1.25) so it fits comfortably within the 80% circle
    draw_daily_voice_emblem(draw_maskable, size // 2, size // 2, scale=1.3, is_maskable=True)

    maskable_512 = maskable_img.resize((512, 512), Image.Resampling.LANCZOS)
    maskable_512.save(os.path.join(PUBLIC_DIR, 'icon-maskable.png'), 'PNG')
    print("Generated icon-maskable.png")

    # 3. Generate Apple Touch Icon (180x180, solid #1C1917, no transparency)
    apple_img = Image.new('RGB', (size, size), (28, 25, 23)) # Solid RGB charcoal
    draw_apple = ImageDraw.Draw(apple_img)
    draw_daily_voice_emblem(draw_apple, size // 2, size // 2, scale=1.45, is_maskable=False)

    apple_180 = apple_img.resize((180, 180), Image.Resampling.LANCZOS)
    apple_180.save(os.path.join(PUBLIC_DIR, 'apple-touch-icon.png'), 'PNG')
    print("Generated apple-touch-icon.png")

if __name__ == '__main__':
    generate_pwa_icons()
