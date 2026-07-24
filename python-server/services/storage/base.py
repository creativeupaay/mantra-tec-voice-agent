"""Abstract base class for storage providers."""

from abc import ABC, abstractmethod
from typing import Optional


class StorageProvider(ABC):
    """Abstract base class defining the storage interface for call recordings."""
    
    @abstractmethod
    async def upload_recording(
        self,
        file_path: str,
        file_content: bytes,
        content_type: str = "audio/mpeg"
    ) -> str:
        """
        Upload a call recording file to storage.
        
        Args:
            file_path: The path/key to store the file under
            file_content: Binary content of the recording
            content_type: MIME type of the file
            
        Returns:
            URL of the uploaded file
        """
        ...
    
    @abstractmethod
    async def get_recording_url(self, file_path: str) -> Optional[str]:
        """Get the public URL for a recording."""
        ...
    
    @abstractmethod
    async def delete_recording(self, file_path: str) -> bool:
        """Delete a recording from storage."""
        ...


class StorageFactory:
    """Factory to create storage provider instances based on configuration."""
    
    @staticmethod
    def create(provider: str, **kwargs) -> StorageProvider:
        """
        Create a storage provider based on the provider name.
        
        Args:
            provider: "s3", "gcs", "azure", or "local"
            **kwargs: Provider-specific configuration
            
        Returns:
            StorageProvider instance
        """
        if provider == "s3":
            from .s3 import S3Storage
            return S3Storage(
                bucket_name=kwargs.get("bucket_name"),
                region=kwargs.get("region", "us-east-1"),
                aws_access_key_id=kwargs.get("aws_access_key_id"),
                aws_secret_access_key=kwargs.get("aws_secret_access_key"),
            )
        elif provider == "gcs":
            from .gcs import GCSStorage
            return GCSStorage(
                bucket_name=kwargs.get("bucket_name"),
                project_id=kwargs.get("project_id"),
                credentials_path=kwargs.get("credentials_path"),
            )
        elif provider == "local":
            from .local import LocalStorage
            return LocalStorage(base_path=kwargs.get("base_path", "./recordings"))
        else:
            raise ValueError(f"Unknown storage provider: {provider}")