"""Google Cloud Storage provider for call recordings."""

import asyncio
from typing import Optional

from google.cloud import storage
from google.oauth2.service_account import Credentials
from loguru import logger


class GCSStorage:
    """Google Cloud Storage provider for call recordings."""
    
    def __init__(
        self,
        bucket_name: str,
        project_id: Optional[str] = None,
        credentials_path: Optional[str] = None,
    ) -> None:
        self.bucket_name = bucket_name
        
        if credentials_path:
            creds = Credentials.from_service_account_file(credentials_path)
            self._client = storage.Client(project=project_id, credentials=creds)
        else:
            self._client = storage.Client(project=project_id)
        
        self._bucket = self._client.bucket(bucket_name)
    
    async def upload_recording(
        self,
        file_path: str,
        file_content: bytes,
        content_type: str = "audio/mpeg"
    ) -> str:
        """Upload a recording to GCS."""
        try:
            loop = asyncio.get_event_loop()
            
            def _upload():
                blob = self._bucket.blob(file_path)
                blob.upload_from_string(file_content, content_type=content_type)
            
            await loop.run_in_executor(None, _upload)
            logger.info(f"[GCS] Uploaded recording to {file_path}")
            
            return await self.get_recording_url(file_path)
        except Exception as e:
            logger.error(f"[GCS] Failed to upload recording {file_path}: {e}")
            raise
    
    async def get_recording_url(self, file_path: str) -> Optional[str]:
        """Get the direct HTTPS URL for the recording."""
        try:
            # Clean leading slashes if present to ensure proper URL formatting
            clean_path = file_path.lstrip("/")
            url = f"https://storage.googleapis.com/{self.bucket_name}/{clean_path}"
            
            logger.info(f"[GCS] Generated direct URL for {file_path}")
            return url
        except Exception as e:
            logger.error(f"[GCS] Failed to generate URL for {file_path}: {e}")
            return None
    
    async def delete_recording(self, file_path: str) -> bool:
        """Delete a recording from GCS."""
        try:
            loop = asyncio.get_event_loop()
            
            def _delete():
                blob = self._bucket.blob(file_path)
                blob.delete()
            
            await loop.run_in_executor(None, _delete)
            logger.info(f"[GCS] Deleted recording {file_path}")
            return True
        except Exception as e:
            logger.error(f"[GCS] Failed to delete recording {file_path}: {e}")
            return False