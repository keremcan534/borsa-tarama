from PIL import Image, ImageDraw

PURPLE = (124, 58, 237, 255)


def draw_icon(size, padding_ratio=0.0):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = int(size * padding_ratio)
    draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=size * 0.22, fill=PURPLE)

    content = size - 2 * pad
    bar_w = content * 0.14
    gap = content * 0.08
    heights = [0.35, 0.55, 0.8]
    total_w = bar_w * 3 + gap * 2
    start_x = pad + (content - total_w) / 2
    base_y = pad + content * 0.78

    for i, h_ratio in enumerate(heights):
        x0 = start_x + i * (bar_w + gap)
        x1 = x0 + bar_w
        bar_h = content * 0.55 * h_ratio
        y0 = base_y - bar_h
        y1 = base_y
        draw.rounded_rectangle([x0, y0, x1, y1], radius=bar_w * 0.25, fill=(255, 255, 255, 255))

    return img


def draw_og_image(width=1200, height=630):
    """Sosyal paylaşım kartı: koyu zemin + logo + başlık."""
    from PIL import ImageFont

    img = Image.new("RGB", (width, height), (15, 17, 21))
    draw = ImageDraw.Draw(img)

    icon = draw_icon(220)
    img.paste(icon, (width // 2 - 110, 110), icon)

    def font(size):
        for name in ("segoeuib.ttf", "arialbd.ttf", "arial.ttf"):
            try:
                return ImageFont.truetype(name, size)
            except OSError:
                continue
        return ImageFont.load_default()

    def center_text(y, text, size, fill):
        f = font(size)
        w = draw.textlength(text, font=f)
        draw.text(((width - w) / 2, y), text, font=f, fill=fill)

    center_text(370, "Borsa Tarama", 64, (243, 244, 246))
    center_text(460, "BIST 100 ve S&P 500 · Günlük Teknik Sinyaller", 30, (167, 139, 250))
    center_text(515, "EMA · MACD · RSI · Stokastik — her gün otomatik", 24, (156, 163, 175))
    return img


draw_icon(192).save("public/icon-192.png")
draw_icon(512).save("public/icon-512.png")
draw_icon(512, padding_ratio=0.1).save("public/icon-maskable-512.png")
draw_og_image().save("public/og-image.png")
print("icons + og-image written")
