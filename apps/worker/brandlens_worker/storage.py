"""Supabase Storage access for the worker (service role). Buckets are private (SPEC §3)."""

from __future__ import annotations

import asyncio
from typing import Any


class Storage:
    def __init__(self, url: str, secret_key: str) -> None:
        self._url = url
        self._key = secret_key
        self._client: Any = None

    def _storage(self) -> Any:
        if self._client is None:
            from supabase import create_client

            self._client = create_client(self._url, self._key)
        return self._client.storage

    async def download(self, bucket: str, path: str) -> bytes:
        data = await asyncio.to_thread(lambda: self._storage().from_(bucket).download(path))
        return bytes(data)

    async def upload(self, bucket: str, path: str, data: bytes, content_type: str) -> None:
        await asyncio.to_thread(
            lambda: (
                self._storage()
                .from_(bucket)
                .upload(path, data, {"content-type": content_type, "upsert": "true"})
            )
        )
