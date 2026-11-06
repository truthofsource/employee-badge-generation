"""Local renderer demonstration; lifecycle rules are the extracted Node source."""

import io
from PIL import Image
import pymupdf
from .render import (
    WIDTH,
    HEIGHT,
    PRINT_WIDTH_PT,
    PRINT_HEIGHT_PT,
    TITLES,
    fictional_portrait,
    example_profile,
    render_badge,
)


def demo():
    profile = example_profile()
    source = fictional_portrait()
    result = render_badge(profile, source)
    with Image.open(io.BytesIO(result["png"])) as image:
        dimensions = image.size
    with pymupdf.open(stream=result["pdf"], filetype="pdf") as document:
        exact_page = (
            len(document) == 1
            and document[0].rect.width == PRINT_WIDTH_PT
            and document[0].rect.height == PRINT_HEIGHT_PT
        )
    changed = render_badge({**profile, "title": TITLES[1]}, source)
    try:
        render_badge({**profile, "title": "Uncontrolled free text"}, source)
        invalid_title = False
    except ValueError:
        invalid_title = True
    try:
        render_badge(profile, b"not an image")
        bad_image = False
    except ValueError:
        bad_image = True
    checks = [
        {
            "name": "Fixed-template PNG generated",
            "passed": dimensions == (WIDTH, HEIGHT),
            "detail": "1013 x 638 pixels; portrait is fitted without stretching",
        },
        {
            "name": "Exact-size PDF generated",
            "passed": exact_page,
            "detail": "One 243 x 153 point page: 3.375 x 2.125 inches",
        },
        {
            "name": "Profile title changes the rendered artifact",
            "passed": changed["png_sha256"] != result["png_sha256"],
            "detail": "The application supplies profile fields; AI does not draw badge text",
        },
        {
            "name": "Unsupported badge title is rejected",
            "passed": invalid_title,
            "detail": "Job title remains separate from application authorization roles",
        },
        {
            "name": "Invalid portrait bytes are rejected",
            "passed": bad_image,
            "detail": "Only bounded, decodable PNG/JPEG input is accepted",
        },
        {
            "name": "Template rendering is repeatable",
            "passed": render_badge(profile, source)["png"] == result["png"],
            "detail": "Identical source/profile inputs produce identical PNG bytes",
        },
    ]
    return {
        "checks": checks,
        "metrics": [
            {
                "label": "Badge outputs",
                "value": "PNG + PDF",
                "detail": "Fixed template; application-rendered text",
            },
            {
                "label": "Print dimensions",
                "value": "3.375 x 2.125",
                "detail": "Inches; print at actual size",
            },
            {
                "label": "Renderer checks",
                "value": str(len(checks)),
                "detail": "Positive and failure cases",
            },
            {
                "label": "Live AI calls",
                "value": "0",
                "detail": "Fictional illustration; optional adapter mocked",
            },
        ],
        "records": [
            ["LAB-EMP-001", "Profile name", "Taylor Morgan"],
            ["PNG preview", "Generated", result["png_sha256"][:16]],
            ["PDF preview", "Generated", result["pdf_sha256"][:16]],
            [
                "Credential state",
                "Example only",
                "This preview is not an issued employee badge",
            ],
        ],
    }
