"""Image checks (P11): OCR, logo detection, WCAG contrast, palette ΔE and warmth.

Every function here is pure (arrays in, dataclasses out) so the fixtures can test it directly.
Images are RGB `uint8` arrays of shape (h, w, 3); boxes are pixel `(x0, y0, x1, y1)`.
"""

from __future__ import annotations

import cv2
import numpy as np
import numpy.typing as npt

RGB = npt.NDArray[np.uint8]
Box = tuple[int, int, int, int]


def decode_image(data: bytes) -> RGB:
    """PNG/JPEG/WebP bytes → RGB array (alpha flattened onto white). Raises ValueError."""
    arr = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
    if arr is None:
        raise ValueError("not a decodable image")
    if arr.ndim == 2:
        arr = cv2.cvtColor(arr, cv2.COLOR_GRAY2BGR)
    if arr.shape[2] == 4:
        alpha = arr[:, :, 3:4].astype(np.float32) / 255.0
        arr = (arr[:, :, :3] * alpha + 255 * (1 - alpha)).astype(np.uint8)
    rgb: RGB = cv2.cvtColor(arr, cv2.COLOR_BGR2RGB)
    return rgb


def encode_png(rgb: RGB) -> bytes:
    ok, buf = cv2.imencode(".png", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    if not ok:  # pragma: no cover - cv2 always encodes uint8 RGB
        raise ValueError("png encode failed")
    return bytes(buf.tobytes())


def union(boxes: list[Box]) -> Box:
    return (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )


def overlap_fraction(inner: Box, outer: Box) -> float:
    """Share of `inner`'s area that lies inside `outer`."""
    w = max(0, min(inner[2], outer[2]) - max(inner[0], outer[0]))
    h = max(0, min(inner[3], outer[3]) - max(inner[1], outer[1]))
    area = max(1, (inner[2] - inner[0]) * (inner[3] - inner[1]))
    return (w * h) / area
