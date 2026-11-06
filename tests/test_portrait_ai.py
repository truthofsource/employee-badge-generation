import base64
import os
import unittest
from unittest.mock import patch
from lab.portrait_ai import prepare_portrait
from lab.render import fictional_portrait


class PortraitAdapterTests(unittest.TestCase):
    def test_default_off(self):
        with self.assertRaises(PermissionError):
            prepare_portrait(fictional_portrait())

    def test_model_is_explicit(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError):
                prepare_portrait(fictional_portrait(), allow_paid=True)

    def test_mock_image_edit_request(self):
        calls = []

        def transport(fields, image):
            calls.append(fields)
            self.assertIn("main portrait", fields["prompt"])
            self.assertIn("hairstyle", fields["prompt"])
            self.assertIn("Never draw a badge", fields["prompt"])
            self.assertEqual(fields["n"], "1")
            return {"data": [{"b64_json": base64.b64encode(image).decode()}]}

        with patch.dict(os.environ, {"OPENAI_IMAGE_MODEL": "approved-image-model"}):
            self.assertTrue(
                prepare_portrait(
                    fictional_portrait(), allow_paid=True, transport=transport
                ).startswith(b"\x89PNG")
            )
        self.assertEqual(len(calls), 1)

    def test_bad_response_is_rejected(self):
        with patch.dict(os.environ, {"OPENAI_IMAGE_MODEL": "approved-image-model"}):
            with self.assertRaises(ValueError):
                prepare_portrait(
                    fictional_portrait(),
                    allow_paid=True,
                    transport=lambda *_: {"data": []},
                )

    def test_unreadable_output_is_rejected(self):
        with patch.dict(os.environ, {"OPENAI_IMAGE_MODEL": "approved-image-model"}):
            with self.assertRaises(ValueError):
                prepare_portrait(
                    fictional_portrait(),
                    allow_paid=True,
                    transport=lambda *_: {
                        "data": [
                            {"b64_json": base64.b64encode(b"not a portrait").decode()}
                        ]
                    },
                )
