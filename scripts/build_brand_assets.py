"""Marka görsellerini (nazar logosu + yıldızlı gökyüzü zemini) üretir.

    python scripts/build_brand_assets.py

Kaynak dosyalar `assets/brand/` altında sürüm kontrolünde durur; bu script
onlardan `frontend/public/` içindeki TÜREVLERİ üretir. Türevler de repoya
konur — çalışma anında hiçbir görsel işlenmez, CI'da Pillow gerekmez.

## Neden türev üretiliyor

- **Logo**: kaynak 1254x1254 lacivert mürekkep çizim (saydam zemin). Arayüzde
  bu PNG bir MASKE olarak kullanılır (`mask-image`) ve rengi CSS'ten gelir —
  böylece koyu temada açık mavi, açık temada lacivert görünür ve tek dosya
  yeter. İkonlarda ise renk gömülü olmak zorunda (maske yok), oradaki mürekkep
  `INK_LIGHT`.
- **Zemin**: gökyüzü fotoğrafı ekranda BULANIK duruyor. Bulanıklığı CSS
  `filter: blur()` ile vermek her karede tüm ekranı yeniden çizdirir (mouse ile
  kaydıkça sürekli). Bulanıklık burada bir kez pişirilir: tarayıcı düz bir
  görsel taşır, `filter` maliyeti sıfır olur. Bulanık görsel çok iyi
  sıkıştığından dosya da küçülür (1,1 MB kaynak -> ~40 KB webp).
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "assets" / "brand"
OUT_DIR = ROOT / "frontend" / "public"

NAZAR_SRC = SRC_DIR / "nazar-source.webp"
SKY_SRC = SRC_DIR / "night-sky-source.jpg"

# Kaynak çizimin mürekkep rengi; ikon zeminleri ve açık varyant bundan türer.
INK = (25, 39, 142)
# Koyu temada kullanılan açık mavi mürekkep (WCAG: #0f1115 üzerinde ~8:1).
INK_LIGHT = (162, 196, 255)
# İkon zemini: gece göğünün lacivertiyle aynı aile.
ICON_BG_TOP = (14, 24, 51)
ICON_BG_BOTTOM = (25, 43, 87)

# Arayüzde en büyük 44 piksel kullanılıyor; 256 retina için de fazlasıyla yeter.
MARK_SIZE = 256

# Zemin görseli: ekranda `object-fit: cover` ile büyütüleceğinden kaynağın
# en-boy oranı korunur; 1600 genişlik geniş ekranda bile yeterli.
SKY_WIDTH = 1600
# Bulanıklık miktarı ölçülerek seçildi: 16 piksel yıldızları tamamen eritip
# zemini renkli bir lekeye çeviriyordu. 6 piksel "bulanık ama hâlâ yıldızlı
# gökyüzü" dengesini tutuyor (1600 -> ~2200 piksele büyütünce ekranda ~8 px).
SKY_BLUR = 6


def load_nazar() -> Image.Image:
    """Çizimi saydam kenar boşluklarından kırpar, kare tuvale oturtur."""
    img = Image.open(NAZAR_SRC).convert("RGBA")
    box = img.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
    if box:
        img = img.crop(box)
    side = max(img.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)
    return square


def recolor(mark: Image.Image, target: tuple[int, int, int]) -> Image.Image:
    """Mürekkebi tek renge boyar, alfayı (dolayısıyla çizgi dokusunu) korur.

    Kalem çizimin ton aralığı dar olduğundan düz boyama çizimi düzleştirmiyor;
    kâğıt zaten saydam, yani boyanan tek şey mürekkep.
    """
    out = Image.new("RGBA", mark.size, target + (0,))
    out.putalpha(mark.getchannel("A"))
    return out


def vertical_gradient(size: tuple[int, int], top, bottom) -> Image.Image:
    grad = Image.new("RGB", (1, size[1]))
    for y in range(size[1]):
        f = y / max(1, size[1] - 1)
        grad.putpixel((0, y), tuple(round(t + (b - t) * f) for t, b in zip(top, bottom)))
    return grad.resize(size, Image.BICUBIC)


def icon(
    mark: Image.Image,
    size: int,
    scale: float,
    radius_ratio: float | None,
    dilate: int = 0,
) -> Image.Image:
    """Gece mavisi zemin + ortada açık mavi nazar.

    `radius_ratio` None ise tuval tam dolar (maskable ikon: köşeleri işletim
    sistemi kırpar, kendimiz yuvarlarsak kırpılınca beyaz köşe kalır).

    `dilate` çizgileri küçültmeden ÖNCE kalınlaştırır. Favicon 16 pikselde
    görünür ve elle çizilmiş ince kalem çizgileri o boyutta tamamen eriyip
    tanınmaz bir lekeye dönüşüyordu; çizgi kalınlaştırılınca göz ve çember
    16 pikselde bile seçilebiliyor.
    """
    canvas = vertical_gradient((size, size), ICON_BG_TOP, ICON_BG_BOTTOM).convert("RGBA")
    if radius_ratio is not None:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, size - 1, size - 1), radius=round(size * radius_ratio), fill=255
        )
        canvas.putalpha(mask)
    glyph = recolor(mark, INK_LIGHT)
    if dilate:
        glyph.putalpha(glyph.getchannel("A").filter(ImageFilter.MaxFilter(dilate)))
    glyph_side = round(size * scale)
    glyph = glyph.resize((glyph_side, glyph_side), Image.LANCZOS)
    offset = (size - glyph_side) // 2
    canvas.alpha_composite(glyph, (offset, offset))
    return canvas


def load_font(size: int) -> ImageFont.FreeTypeFont | None:
    for candidate in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ):
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return None


def build_og_image(mark: Image.Image, sky: Image.Image) -> Image.Image:
    """1200x630 paylaşım görseli: bulanık gökyüzü + nazar + marka adı.

    Zaten bulanık olan görsel 256 renge indirgenince bant oluşmuyor ve PNG
    1,6 MB'den ~200 KB'ye iniyor; adres arşivdeki raporlara gömülü olduğundan
    biçim PNG kalmak zorunda.
    """
    width, height = 1200, 630
    scale = max(width / sky.width, height / sky.height)
    stage = sky.resize((round(sky.width * scale), round(sky.height * scale)), Image.LANCZOS)
    left = (stage.width - width) // 2
    top = (stage.height - height) // 2
    card = stage.crop((left, top, left + width, top + height)).convert("RGBA")
    card.alpha_composite(Image.new("RGBA", (width, height), (8, 12, 26, 110)))

    glyph_side = 300
    glyph = recolor(mark, INK_LIGHT).resize((glyph_side, glyph_side), Image.LANCZOS)
    card.alpha_composite(glyph, (96, (height - glyph_side) // 2))

    draw = ImageDraw.Draw(card)
    title_font = load_font(74)
    sub_font = load_font(32)
    if title_font and sub_font:
        draw.text((440, 250), "Borsa Tarama", font=title_font, fill=(244, 247, 255, 255))
        draw.text(
            (444, 344),
            "BIST ve S&P 500 teknik tarama",
            font=sub_font,
            fill=(178, 197, 236, 255),
        )
    return card.convert("RGB").quantize(colors=256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG)


def main() -> int:
    for path in (NAZAR_SRC, SKY_SRC):
        if not path.exists():
            print(f"[HATA] kaynak yok: {path}")
            return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    mark = load_nazar()
    written: list[tuple[Path, int]] = []

    def save(img: Image.Image, name: str, **kwargs) -> None:
        path = OUT_DIR / name
        kwargs.setdefault("optimize", True)
        img.save(path, **kwargs)
        written.append((path, path.stat().st_size))

    # Arayüz markası: CSS maskesi olarak kullanıldığından yalnızca alfa kanalı
    # önemli; renk düzleştirilir. Kaynak zaten tek kalemle çizilmiş, düzleştirmek
    # görünümü değiştirmiyor ama dosyayı ~4 kat küçültüyor (277 KB -> 68 KB).
    save(recolor(mark, INK).resize((MARK_SIZE, MARK_SIZE), Image.LANCZOS), "brand-mark.png")

    # PWA / sekme ikonları
    save(icon(mark, 192, 0.80, 0.22), "icon-192.png")
    save(icon(mark, 512, 0.80, 0.22), "icon-512.png")
    # Maskable: güvenli alan tuvalin %80'i, çizim onun içinde kalmalı.
    save(icon(mark, 512, 0.60, None), "icon-maskable-512.png")
    save(icon(mark, 64, 0.98, 0.22, dilate=17), "favicon.png")

    sky = Image.open(SKY_SRC).convert("RGB")
    height = round(SKY_WIDTH * sky.height / sky.width)
    blurred = sky.resize((SKY_WIDTH, height), Image.LANCZOS).filter(
        ImageFilter.GaussianBlur(SKY_BLUR)
    )
    save(blurred, "bg-night.webp", format="WEBP", quality=82, method=6)
    # Dosya adı `og-image.png` olarak KALMALI: arşivdeki yüzlerce rapor sayfası
    # (reports/*.html) bu adrese meta etiketiyle bağlı.
    save(build_og_image(mark, blurred), "og-image.png")

    for path, size in written:
        print(f"[MARKA] {path.relative_to(ROOT)} ({size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
