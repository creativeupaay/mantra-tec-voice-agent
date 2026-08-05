"""Google Cloud Storage provider for call recordings with local fallback and robust error reporting."""

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
                logger.info(f"[GCS] Initialized GCS client using service account key file: {credentials_path}")
            elif os.getenv("GOOGLE_APPLICATION_CREDENTIALS") and os.path.exists(os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")):
                key_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
                creds = Credentials.from_service_account_file(key_path)
                self._client = storage.Client(project=project_id, credentials=creds)
                logger.info(f"[GCS] Initialized GCS client using GOOGLE_APPLICATION_CREDENTIALS: {key_path}")
            else:
                # Default ADC (Cloud Run attached Service Account / ADC)
                self._client = storage.Client(project=project_id)
                logger.info(f"[GCS] Initialized GCS client using Default Application Credentials (ADC) for project '{project_id}'")
            
            self._bucket = self._client.bucket(self.bucket_name)
        except Exception as e:
            logger.warning(f"[GCS] Initialized GCS Storage client warning: {e}. Will fallback to local storage if GCS calls fail.")
    
    async def upload_recording(
        self,
        file_path: str,
        file_content: bytes,
        content_type: str = "audio/wav"
    ) -> str:
        """Upload a recording to GCS bucket and save local fallback copies."""
        clean_path = file_path.lstrip("/")
        filename = os.path.basename(clean_path)
        
        # 1. Always save local copies first to guarantee zero audio loss
        try:
            p1 = os.path.join(".", "recordings", filename)
            p2 = os.path.join("..", "server", "recordings", filename)
            for p in (p1, p2):
                os.makedirs(os.path.dirname(p), exist_ok=True)
                with open(p, "wb") as f:
                    f.write(file_content)
            logger.info(f"[LocalStorage] Saved local recording copies for {filename} ({len(file_content)} bytes)")
        except Exception as e:
            logger.warning(f"[LocalStorage] Could not write local copy of recording: {e}")

        # 2. Upload to GCS bucket
        if self._bucket:
            try:
                loop = asyncio.get_event_loop()
                
                def _upload():
                    blob = self._bucket.blob(clean_path)
                    blob.upload_from_string(file_content, content_type=content_type)
                
                await loop.run_in_executor(None, _upload)
                logger.info(f"[GCS] SUCCESS: Uploaded {len(file_content)} bytes to bucket '{self.bucket_name}', path '{clean_path}'")
            except Exception as e:
                logger.error(
                    f"[GCS] UPLOAD ERROR: Failed to upload recording '{clean_path}' to GCS bucket '{self.bucket_name}'. "
                    f"Ensure Cloud Run Service Account has 'Storage Object Admin' role in GCP IAM. Error: {e}"
                )
        
        return f"https://storage.googleapis.com/{self.bucket_name}/{clean_path}"
    
    async def get_recording_url(self, file_path: str) -> Optional[str]:
        """Get the direct HTTPS URL for the recording."""
        try:
            clean_path = file_path.lstrip("/")
            url = f"https://storage.googleapis.com/{self.bucket_name}/{clean_path}"
            return url
        except Exception as e:
            logger.error(f"[GCS] Failed to generate URL for {file_path}: {e}")
            return None
    
    async def delete_recording(self, file_path: str) -> bool:
        """Delete a recording from GCS and local storage."""
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

        # Also delete local files if existing
        for p in (os.path.join(".", "recordings", os.path.basename(clean_path)), os.path.join("..", "server", "recordings", os.path.basename(clean_path))):
            if os.path.exists(p):
                try:
                    os.remove(p)
                    logger.info(f"[LocalStorage] Deleted local recording file {p}")
                    deleted = True
                except Exception as e:
                    logger.warning(f"[LocalStorage] Could not delete {p}: {e}")

        return deleted