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


draw_icon(192).save("public/icon-192.png")
draw_icon(512).save("public/icon-512.png")
draw_icon(512, padding_ratio=0.1).save("public/icon-maskable-512.png")
print("icons written")
