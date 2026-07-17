"""Local filesystem storage provider for call recordings."""

import os
from typing import Optional

from loguru import logger


class LocalStorage:
    """Local filesystem storage provider for development/testing."""
    
    def __init__(self, base_path: str = "./recordings"):
        self.base_path = base_path
        os.makedirs(base_path, exist_ok=True)
    
    async def upload_recording(
        self,
        file_path: str,
        file_content: bytes,
        content_type: str = "audio/mpeg"
    ) -> str:
        """Save recording to local filesystem."""
        full_path = os.path.join(self.base_path, file_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        with open(full_path, "wb") as f:
            f.write(file_content)
        
        logger.info(f"[LocalStorage] Saved recording to {full_path}")
        return f"file://{full_path}"
    
    async def get_recording_url(self, file_path: str) -> Optional[str]:
        """Return local file path as URL."""
        full_path = os.path.join(self.base_path, file_path)
        if os.path.exists(full_path):
            return f"file://{full_path}"
        return None
    
    async def delete_recording(self, file_path: str) -> bool:
        """Delete recording from local filesystem."""
        full_path = os.path.join(self.base_path, file_path)
        if os.path.exists(full_path):
            os.remove(full_path)
            logger.info(f"[LocalStorage] Deleted {full_path}")
            return True
        return False