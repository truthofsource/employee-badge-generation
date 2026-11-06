# AI-assisted portrait preparation

## Actual platform design

The source system accepts an authorized government-ID image or standalone headshot. It prepares the main portrait, preserves visible appearance and hairstyle, uses a light neutral-gray background, then gives the resulting image to a fixed application renderer. The renderer owns profile name, job title, logo and print layout.

Do not use the smaller ghost portrait. Correct visible orientation/perspective without inventing obscured identity details. Transparent sheen can only be reduced where detail remains visible. If essential features are hidden by blur, glare or opaque markings, use a separate headshot. AI output is not identity verification.

## Public adapter boundary

`lab/portrait_ai.py` makes an optional multipart image-edit request to `/v1/images/edits`. It requires an explicit approved image model and paid-call opt-in, removes input metadata, bounds input/response size, checks decodable output and makes no automatic paid retry. It rejects redirects and avoids logging source/key/response bodies.

```python
# Optional integration example, not executed by the demo or CI.
from lab.portrait_ai import prepare_portrait

# Configure OPENAI_IMAGE_MODEL and the credential through the approved secret process.
# approved_image_bytes must come from an authorized source, never an arbitrary URL.
prepared_bytes = prepare_portrait(approved_image_bytes, allow_paid=True)
```

The public adapter represents the edit boundary, not the entire hosted pre/post-image assessment, Key Vault resolver or distributed paid-call admission system. A successful mocked request does not prove real portrait quality. No real employee image or paid request was used for this public example.

## What the demo shows

The local preview uses an original code-drawn illustration of a fictional employee. It demonstrates rendering and lifecycle rules, not before/after AI quality. Actual nonproduction portrait preparation screenshots can be added later with approved fictional input and no private ID details.

## Official API reference

[OpenAI image generation and editing](https://developers.openai.com/api/docs/guides/image-generation) documents the image-edit endpoint and model-specific options. Select an approved model explicitly; this project does not silently choose a latest model or activate a key.
