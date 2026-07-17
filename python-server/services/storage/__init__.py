"""Storage abstraction for call recordings."""

from .base import StorageProvider, StorageFactory
from .s3 import S3Storage
from .gcs import GCSStorage
from .local import LocalStorage

__all__ = [
    "StorageProvider", 
    "StorageFactory", 
    "S3Storage", 
    "GCSStorage",
    "LocalStorage"
]