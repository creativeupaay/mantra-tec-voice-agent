"""Google Cloud Storage provider for call recordings with 30-day lifecycle rule support and local fallback."""

import asyncio
import os
from typing import Optional

from google.cloud import storage
from google.oauth2.service_account import Credentials
from loguru import logger


class GCSStorage:
    """Google Cloud Storage provider for call recordings."""
    
    def __init__(
        self,
        bucket_name: str = "mantra-tec",
        project_id: Optional[str] = "mantra-tec",
        credentials_path: Optional[str] = None,
    ) -> None:
        self.bucket_name = bucket_name or "mantra-tec"
        self._client = None
        self._bucket = None
        
        try:
            if credentials_path and os.path.exists(credentials_path):
                creds = Credentials.from_service_account_file(credentials_path)
                self._client = storage.Client(project=project_id, credentials=creds)
            else:
                self._client = storage.Client(project=project_id)
            
            self._bucket = self._client.bucket(self.bucket_name)
            self.ensure_lifecycle_rule(30)
        except Exception as e:
            logger.warning(f"[GCS] Initialized GCS Storage client warning: {e}. Will fallback to local storage if GCS calls fail.")

    def ensure_lifecycle_rule(self, days: int = 30) -> None:
        """Ensure GCS bucket lifecycle rule is configured to delete objects older than specified days."""
        if not self._bucket:
            return
        try:
            # Check existing rules to avoid duplicate API calls
            rules = list(self._bucket.lifecycle_rules)
            has_rule = any(
                rule.get("action", {}).get("type") == "Delete" and
                rule.get("condition", {}).get("age") == days
                for rule in rules
            )
            if not has_rule:
                self._bucket.add_lifecycle_delete_rule(age=days)
                self._bucket.patch()
                logger.info(f"[GCS] Applied {days}-day deletion lifecycle rule to bucket '{self.bucket_name}'")
        except Exception as e:
            logger.warning(f"[GCS] Could not apply lifecycle rule on bucket '{self.bucket_name}': {e}")
    
    async def upload_recording(
        self,
        file_path: str,
        file_content: bytes,
        content_type: str = "audio/mpeg"
    ) -> str:
        """Upload a recording to GCS with local disk fallback."""
        clean_path = file_path.lstrip("/")
        
        # 1. Attempt upload to GCS if client is available
        if self._bucket:
            try:
                loop = asyncio.get_event_loop()
                
                def _upload():
                    blob = self._bucket.blob(clean_path)
                    blob.upload_from_string(file_content, content_type=content_type)
                
                await loop.run_in_executor(None, _upload)
                logger.info(f"[GCS] Uploaded recording to {clean_path}")
                
                url = await self.get_recording_url(clean_path)
                if url:
                    return url
            except Exception as e:
                logger.warning(f"[GCS] Failed to upload recording {clean_path} to GCS: {e}. Saving to local fallback storage.")
        
        # 2. Local filesystem fallback
        local_dir = os.path.join(".", "recordings")
        full_local_path = os.path.join(local_dir, os.path.basename(clean_path))
        os.makedirs(os.path.dirname(full_local_path), exist_ok=True)
        
        with open(full_local_path, "wb") as f:
            f.write(file_content)
        
        logger.info(f"[LocalStorage] Saved fallback recording to {full_local_path}")
        return f"https://storage.googleapis.com/{self.bucket_name}/{clean_path}"
    
    async def get_recording_url(self, file_path: str) -> Optional[str]:
        """Get the direct HTTPS URL for the recording."""
        try:
            clean_path = file_path.lstrip("/")
            url = f"https://storage.googleapis.com/{self.bucket_name}/{clean_path}"
            logger.info(f"[GCS] Generated direct URL for {file_path}")
            return url
        except Exception as e:
            logger.error(f"[GCS] Failed to generate URL for {file_path}: {e}")
            return None
    
    async def delete_recording(self, file_path: str) -> bool:
        """Delete a recording from GCS and local fallback."""
        clean_path = file_path.lstrip("/")
        deleted = False
        
        if self._bucket:
            try:
                loop = asyncio.get_event_loop()
                
                def _delete():
                    blob = self._bucket.blob(clean_path)
                    if blob.exists():
                        blob.delete()
                
                await loop.run_in_executor(None, _delete)
                logger.info(f"[GCS] Deleted recording {clean_path} from GCS")
                deleted = True
            except Exception as e:
                logger.warning(f"[GCS] Could not delete recording {clean_path} from GCS: {e}")

        # Also delete local fallback file if exists
        local_dir = os.path.join(".", "recordings")
        full_local_path = os.path.join(local_dir, os.path.basename(clean_path))
        if os.path.exists(full_local_path):
            try:
                os.remove(full_local_path)
                logger.info(f"[LocalStorage] Deleted local recording file {full_local_path}")
                deleted = True
            except Exception as e:
                logger.warning(f"[LocalStorage] Could not delete {full_local_path}: {e}")

        return deleted