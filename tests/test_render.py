import io
import tempfile
import unittest
from pathlib import Path
from PIL import Image
import pymupdf
from lab.render import (
    fictional_portrait,
    example_profile,
    render_badge,
    export_example,
    TITLES,
    portrait,
)


class BadgeRenderTests(unittest.TestCase):
    def test_exact_print_size(self):
        result = render_badge(example_profile(), fictional_portrait())
        with pymupdf.open(stream=result["pdf"], filetype="pdf") as pdf:
            self.assertEqual(len(pdf), 1)
            self.assertEqual((pdf[0].rect.width, pdf[0].rect.height), (243, 153))

    def test_png_dimensions(self):
        result = render_badge(example_profile(), fictional_portrait())
        with Image.open(io.BytesIO(result["png"])) as image:
            self.assertEqual(image.size, (1013, 638))

    def test_repeatable_png(self):
        self.assertEqual(
            render_badge(example_profile(), fictional_portrait())["png"],
            render_badge(example_profile(), fictional_portrait())["png"],
        )

    def test_profile_name_changes_artifact(self):
        profile = example_profile()
        source = fictional_portrait()
        self.assertNotEqual(
            render_badge(profile, source)["png_sha256"],
            render_badge({**profile, "name": "Jordan Blake"}, source)["png_sha256"],
        )

    def test_supported_titles(self):
        for title in TITLES:
            self.assertTrue(
                render_badge(
                    {**example_profile(), "title": title}, fictional_portrait()
                )["pdf"]
            )

    def test_free_text_title_rejected(self):
        with self.assertRaises(ValueError):
            render_badge(
                {**example_profile(), "title": "Uncontrolled"}, fictional_portrait()
            )

    def test_browser_name_override_rejected(self):
        with self.assertRaises(ValueError):
            render_badge(
                {**example_profile(), "name_override": "Another Person"},
                fictional_portrait(),
            )

    def test_bad_source_rejected(self):
        with self.assertRaises(ValueError):
            portrait(b"not an image")

    def test_too_small_image_rejected(self):
        data = io.BytesIO()
        Image.new("RGB", (20, 20)).save(data, format="PNG")
        with self.assertRaises(ValueError):
            portrait(data.getvalue())

    def test_export_does_not_overwrite_previous_preview(self):
        with tempfile.TemporaryDirectory() as root:
            export_example(root)
            before = (Path(root) / "fictional-badge.png").read_bytes()
            with self.assertRaises(FileExistsError):
                export_example(root)
            self.assertEqual(before, (Path(root) / "fictional-badge.png").read_bytes())
