"""Fixed-template renderer for a fictional public badge example."""

import hashlib
import io
from pathlib import Path
import warnings

from PIL import Image, ImageDraw, ImageFont, ImageOps
import pymupdf

WIDTH, HEIGHT = 1013, 638
PRINT_WIDTH_PT, PRINT_HEIGHT_PT = 243, 153
TITLES = ("Caregiver / Direct Support Professional", "Supervisor", "Administrator")
MAX_BYTES, MAX_PIXELS = 5 * 1024 * 1024, 20_000_000


def digest(data):
    return hashlib.sha256(data).hexdigest()


def portrait(data):
    if not isinstance(data, bytes) or not 0 < len(data) <= MAX_BYTES:
        raise ValueError("Supply a PNG/JPEG portrait within the 5 MiB limit")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as source:
                if (
                    source.format not in {"PNG", "JPEG"}
                    or source.width * source.height > MAX_PIXELS
                ):
                    raise ValueError("Unsupported image type or image dimensions")
                if min(source.size) < 64:
                    raise ValueError(
                        "Use a portrait of at least 64 pixels on each side"
                    )
                return ImageOps.exif_transpose(source).convert("RGB")
    except (
        OSError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as error:
        raise ValueError("The portrait image could not be decoded safely") from error


def fictional_portrait():
    """An original code-drawn illustration; no real person or identity document."""
    image = Image.new("RGB", (480, 600), "#D9D9D9")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((70, 390, 410, 680), radius=100, fill="#1D5265")
    draw.rectangle((205, 310, 275, 432), fill="#B98D74")
    draw.ellipse((132, 90, 348, 370), fill="#BD927A")
    draw.pieslice((125, 70, 355, 265), 180, 355, fill="#333943")
    draw.line((188, 244, 208, 244), fill="#313845", width=5)
    draw.line((271, 244, 291, 244), fill="#313845", width=5)
    draw.arc((207, 276, 273, 321), 5, 175, fill="#6E5046", width=4)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def fit_text(draw, text, max_width, size, *, minimum=18):
    while size >= minimum:
        font = ImageFont.load_default(size=size)
        if draw.textbbox((0, 0), text, font=font)[2] <= max_width:
            return font
        size -= 1
    raise ValueError(
        "Profile text exceeds the template space; shorten the display value"
    )


def render_badge(profile, portrait_bytes):
    """Profile input represents a server-read snapshot, not a browser-supplied name."""
    if set(profile) != {"employee_id", "name", "title"}:
        raise ValueError("Use the exact employee profile fields")
    if not all(isinstance(value, str) and value.strip() for value in profile.values()):
        raise ValueError("Employee identity, profile name and job title are required")
    if len(profile["name"]) > 100 or len(profile["employee_id"]) > 48:
        raise ValueError("Profile text is outside the display limit")
    if profile["title"] not in TITLES:
        raise ValueError(
            "Choose a supported badge job title; titles do not grant access roles"
        )
    face = portrait(portrait_bytes)
    card = Image.new("RGB", (WIDTH, HEIGHT), "white")
    draw = ImageDraw.Draw(card)
    draw.rectangle((0, 0, WIDTH, 105), fill="#123C50")
    draw.rectangle((44, 28, 58, 77), fill="#61C9B5")
    draw.rectangle((65, 42, 79, 77), fill="#8CCFE6")
    draw.text(
        (100, 30), "WORKFORCE", font=ImageFont.load_default(size=33), fill="white"
    )
    draw.text(
        (640, 42),
        "EMPLOYEE BADGE",
        font=ImageFont.load_default(size=20),
        fill="#D7EDF3",
    )
    box = (45, 145, 345, 525)
    # Contain and pad: preserve the supplied head instead of stretching it.
    fitted = ImageOps.contain(face, (box[2] - box[0] - 16, box[3] - box[1] - 16))
    draw.rectangle(box, fill="#D9D9D9", outline="#8CCFE6", width=8)
    card.paste(
        fitted,
        ((box[0] + box[2] - fitted.width) // 2, (box[1] + box[3] - fitted.height) // 2),
    )
    name = profile["name"].strip()
    draw.text((390, 177), name, font=fit_text(draw, name, 565, 47), fill="#153C50")
    draw.text(
        (392, 264),
        profile["title"],
        font=fit_text(draw, profile["title"], 565, 27),
        fill="#176C70",
    )
    draw.line((392, 326, 945, 326), fill="#DCE7EB", width=3)
    draw.text(
        (392, 357), "PROFILE ID", font=ImageFont.load_default(size=17), fill="#647783"
    )
    draw.text(
        (392, 391),
        profile["employee_id"],
        font=fit_text(draw, profile["employee_id"], 550, 28),
        fill="#243746",
    )
    draw.text(
        (45, 574),
        "FICTIONAL EXAMPLE - NOT A VALID CREDENTIAL",
        font=ImageFont.load_default(size=20),
        fill="#647783",
    )
    stream = io.BytesIO()
    card.save(stream, format="PNG", dpi=(300, 300))
    png = stream.getvalue()
    with pymupdf.open() as document:
        page = document.new_page(width=PRINT_WIDTH_PT, height=PRINT_HEIGHT_PT)
        page.insert_image(page.rect, stream=png)
        pdf = document.tobytes(garbage=4, deflate=True)
    return {
        "png": png,
        "pdf": pdf,
        "portrait_sha256": digest(portrait_bytes),
        "png_sha256": digest(png),
        "pdf_sha256": digest(pdf),
    }


def example_profile():
    return {"employee_id": "LAB-EMP-001", "name": "Taylor Morgan", "title": TITLES[0]}


def export_example(directory):
    """Export a preview, never an issued employee credential."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    result = render_badge(example_profile(), fictional_portrait())
    for kind in ["png", "pdf"]:
        target = directory / ("fictional-badge." + kind)
        with target.open("xb") as output:
            output.write(result[kind])
    return result
