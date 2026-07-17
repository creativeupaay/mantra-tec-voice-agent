"""S3 storage provider for call recordings using boto3."""

import asyncio
from typing import Optional

import boto3
from botocore.config import Config
from loguru import logger


class S3Storage:
    """AWS S3 storage provider for call recordings."""
    
    def __init__(
        self,
        bucket_name: str,
        region: str = "us-east-1",
        aws_access_key_id: Optional[str] = None,
        aws_secret_access_key: Optional[str] = None,
        endpoint_url: Optional[str] = None,  # For S3-compatible services like MinIO
        presigned_url_expiry: int = 3600,  # 1 hour default
    ) -> None:
        self.bucket_name = bucket_name
        self.region = region
        self.presigned_url_expiry = presigned_url_expiry
        
        # Configure boto3 client
        kwargs = {"region_name": region}
        if aws_access_key_id and aws_secret_access_key:
            kwargs["aws_access_key_id"] = aws_access_key_id
            kwargs["aws_secret_access_key"] = aws_secret_access_key
        if endpoint_url:
            kwargs["endpoint_url"] = endpoint_url
            
        self._client = boto3.client("s3", config=Config(signature_version="s3v4"), **kwargs)
        self._s3 = boto3.resource("s3", **kwargs)
    
    async def upload_recording(
        self,
        file_path: str,
        file_content: bytes,
        content_type: str = "audio/mpeg"
    ) -> str:
        """
        Upload a recording to S3.
        
        Args:
            file_path: The S3 key/path for the recording
            file_content: Binary content of the recording
            content_type: MIME type (default: audio/mpeg)
            
        Returns:
            Presigned URL to the uploaded file
        """
        try:
            loop = asyncio.get_event_loop()
            
            def _upload():
                self._client.put_object(
                    Bucket=self.bucket_name,
                    Key=file_path,
                    Body=file_content,
                    ContentType=content_type,
                    ACL="private"
                )
            
            await loop.run_in_executor(None, _upload)
            logger.info(f"[S3] Uploaded recording to {file_path}")
            
            return await self.get_recording_url(file_path)
        except Exception as e:
            logger.error(f"[S3] Failed to upload recording {file_path}: {e}")
            raise
    
    async def get_recording_url(self, file_path: str) -> Optional[str]:
        """Generate a presigned URL for the recording."""
        try:
            loop = asyncio.get_event_loop()
            
            def _get_url():
                return self._client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": self.bucket_name, "Key": file_path},
                    ExpiresIn=self.presigned_url_expiry
                )
            
            url = await loop.run_in_executor(None, _get_url)
            logger.info(f"[S3] Generated presigned URL for {file_path}")
            return url
        except Exception as e:
            logger.error(f"[S3] Failed to generate URL for {file_path}: {e}")
            return None
    
    async def delete_recording(self, file_path: str) -> bool:
        """Delete a recording from S3."""
        try:
            loop = asyncio.get_event_loop()
            
            def _delete():
                self._client.delete_object(
                    Bucket=self.bucket_name,
                    Key=file_path
                )
            
            await loop.run_in_executor(None, _delete)
            logger.info(f"[S3] Deleted recording {file_path}")
            return True
        except Exception as e:
            logger.error(f"[S3] Failed to delete recording {file_path}: {e}")
            return False