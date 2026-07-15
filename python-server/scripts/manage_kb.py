#!/usr/bin/env python3
"""CLI management utility for Qdrant Knowledge Base.

Supports:
- Clear: Delete and recreate the collection.
- Ingest: Chunk, embed, and upload Markdown files to Qdrant.

Usage:
    python scripts/manage_kb.py clear
    python scripts/manage_kb.py ingest --file path/to/file.md
    python scripts/manage_kb.py ingest --dir path/to/directory
"""

import os
import sys
import re
import uuid
import argparse
import asyncio
from pathlib import Path
from typing import List, Dict

import httpx
from loguru import logger

# Add parent directory to sys.path so we can import env_config and services
server_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(server_dir))

from env_config import settings


def get_qdrant_client():
    """Instantiate and return AsyncQdrantClient."""
    try:
        from qdrant_client import AsyncQdrantClient
    except ImportError:
        logger.error("qdrant-client is not installed. Please run: uv add qdrant-client")
        sys.exit(1)

    return AsyncQdrantClient(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key or None,
    )


async def get_embeddings(texts: List[str]) -> List[List[float]]:
    """Fetch embeddings in batch from OpenRouter API."""
    if not texts:
        return []

    if not settings.openrouter_api_key:
        logger.error("OPENROUTER_API_KEY is not configured in environment/.env")
        sys.exit(1)

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/embeddings",
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "text-embedding-3-small",
                "input": texts,
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        data = resp.json()
        
        # Sort by index to guarantee original order matches embeddings
        items = data.get("data", [])
        items_sorted = sorted(items, key=lambda x: x.get("index", 0))
        return [item["embedding"] for item in items_sorted]


def get_sparse_embedding_model():
    """Load the fastembed SparseTextEmbedding model."""
    try:
        from fastembed import SparseTextEmbedding
        # Use bm25 model to generate sparse vectors
        return SparseTextEmbedding("Qdrant/bm25")
    except ImportError:
        logger.error("fastembed is not installed. Please run: uv add fastembed")
        sys.exit(1)


def chunk_markdown(text: str, filename: str, max_chunk_size: int = 800) -> List[Dict]:
    """Chunks markdown text by sections based on headers, splitting large sections recursively.
    
    Uses LangChain's MarkdownHeaderTextSplitter and RecursiveCharacterTextSplitter.
    """
    try:
        from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
    except ImportError:
        logger.error("langchain-text-splitters is not installed. Please run: uv add langchain-text-splitters")
        sys.exit(1)

    headers_to_split_on = [
        ("#", "Header 1"),
        ("##", "Header 2"),
        ("###", "Header 3"),
        ("####", "Header 4"),
        ("#####", "Header 5"),
        ("######", "Header 6"),
    ]

    markdown_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
    md_header_splits = markdown_splitter.split_text(text)

    # We use a slight overlap to maintain context between chunks
    overlap = int(max_chunk_size * 0.1)
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=max_chunk_size,
        chunk_overlap=overlap,
    )
    splits = text_splitter.split_documents(md_header_splits)

    chunks = []
    basename = Path(filename).name

    for idx, split in enumerate(splits):
        metadata = split.metadata
        header_path = " > ".join(metadata.values())
        
        header_context = f"[Document: {basename}"
        if header_path:
            header_context += f" > Section: {header_path}"
        header_context += "]\n\n"
        
        chunk_text = header_context + split.page_content
        source = f"{basename}#{header_path}" if header_path else basename

        chunks.append({
            "text": chunk_text,
            "source": source,
            "file_name": basename,
            "chunk_index": idx
        })

    return chunks


async def clear_kb():
    """Delete the collection if it exists and recreate it empty."""
    client = get_qdrant_client()
    collection_name = settings.kb_collection
    
    logger.info(f"Connecting to Qdrant at {settings.qdrant_url}...")
    try:
        exists = await client.collection_exists(collection_name)
        if exists:
            logger.info(f"Deleting existing collection '{collection_name}'...")
            await client.delete_collection(collection_name)
            logger.success(f"Collection '{collection_name}' deleted.")
            
        from qdrant_client.models import Distance, VectorParams, SparseVectorParams, Modifier
        logger.info(f"Creating collection '{collection_name}' with dense and sparse (BM25) vectors...")
        await client.create_collection(
            collection_name=collection_name,
            vectors_config={"dense": VectorParams(size=1536, distance=Distance.COSINE)},
            sparse_vectors_config={"bm25": SparseVectorParams(modifier=Modifier.IDF)},
        )
        logger.success(f"Collection '{collection_name}' created successfully.")
    except Exception as e:
        logger.error(f"Failed to clear knowledge base: {e}")
        sys.exit(1)
    finally:
        await client.close()


async def ingest_chunks(chunks: List[Dict]):
    """Embed chunks (dense + sparse) and upload them to the Qdrant collection."""
    if not chunks:
        logger.warning("No chunks found to ingest.")
        return
        
    client = get_qdrant_client()
    collection_name = settings.kb_collection
    
    try:
        # Check and auto-create collection if missing
        exists = await client.collection_exists(collection_name)
        if not exists:
            from qdrant_client.models import Distance, VectorParams, SparseVectorParams, Modifier
            logger.info(f"Collection '{collection_name}' not found. Creating it...")
            await client.create_collection(
                collection_name=collection_name,
                vectors_config={"dense": VectorParams(size=1536, distance=Distance.COSINE)},
                sparse_vectors_config={"bm25": SparseVectorParams(modifier=Modifier.IDF)},
            )
            
        logger.info(f"Generating dense embeddings for {len(chunks)} chunk(s)...")
        texts = [c["text"] for c in chunks]
        
        # Batch requests for dense embeddings
        embeddings = []
        batch_size = 16
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]
            logger.info(f"  Processing dense batch {i//batch_size + 1}/{(len(texts)-1)//batch_size + 1}...")
            batch_embeddings = await get_embeddings(batch_texts)
            embeddings.extend(batch_embeddings)
            
        if len(embeddings) != len(chunks):
            logger.error(f"Embeddings count mismatch: generated {len(embeddings)}, expected {len(chunks)}")
            return
            
        logger.info(f"Generating sparse (BM25) embeddings for {len(chunks)} chunk(s)...")
        sparse_model = get_sparse_embedding_model()
        sparse_embeddings_generator = sparse_model.embed(texts)
        sparse_embeddings = list(sparse_embeddings_generator)
            
        # Create Qdrant points
        from qdrant_client.models import PointStruct, SparseVector
        points = []
        for idx, chunk in enumerate(chunks):
            point_id = str(uuid.uuid4())
            points.append(PointStruct(
                id=point_id,
                vector={
                    "dense": embeddings[idx],
                    "bm25": SparseVector(
                        indices=sparse_embeddings[idx].indices.tolist(),
                        values=sparse_embeddings[idx].values.tolist()
                    )
                },
                payload={
                    "text": chunk["text"],
                    "source": chunk["source"],
                    "file_name": chunk["file_name"],
                    "chunk_index": chunk["chunk_index"]
                }
            ))
            
        logger.info(f"Upserting {len(points)} points to Qdrant collection '{collection_name}'...")
        # Batch upsert points
        upsert_batch_size = 100
        for i in range(0, len(points), upsert_batch_size):
            batch_points = points[i:i + upsert_batch_size]
            await client.upsert(
                collection_name=collection_name,
                points=batch_points,
            )
        logger.success(f"Successfully ingested {len(points)} point(s) into '{collection_name}'.")
    except Exception as e:
        logger.error(f"Failed to ingest chunks: {e}")
        sys.exit(1)
    finally:
        await client.close()


async def main():
    parser = argparse.ArgumentParser(description="Mantra Tech Knowledge Base CLI Manager")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    # 'clear' command
    subparsers.add_parser("clear", help="Clear (delete and recreate) the Qdrant collection")
    
    # 'ingest' command
    ingest_parser = subparsers.add_parser("ingest", help="Ingest Markdown files")
    group = ingest_parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--file", "-f", help="Path to a single markdown file")
    group.add_argument("--dir", "-d", help="Path to a directory containing markdown files")
    
    args = parser.parse_args()
    
    if args.command == "clear":
        await clear_kb()
        
    elif args.command == "ingest":
        all_chunks = []
        
        if args.file:
            path = Path(args.file)
            if not path.is_file():
                logger.error(f"File not found: {args.file}")
                sys.exit(1)
            text = path.read_text(encoding="utf-8")
            chunks = chunk_markdown(text, str(path))
            all_chunks.extend(chunks)
            logger.info(f"Parsed {len(chunks)} chunk(s) from {path.name}")
            
        elif args.dir:
            dir_path = Path(args.dir)
            if not dir_path.is_dir():
                logger.error(f"Directory not found: {args.dir}")
                sys.exit(1)
                
            md_files = list(dir_path.glob("**/*.md")) + list(dir_path.glob("**/*.txt"))
            if not md_files:
                logger.warning(f"No markdown (.md) or text (.txt) files found in {args.dir}")
                sys.exit(0)
                
            logger.info(f"Found {len(md_files)} files in {args.dir}. Parsing...")
            for file_path in md_files:
                try:
                    text = file_path.read_text(encoding="utf-8")
                    chunks = chunk_markdown(text, str(file_path))
                    all_chunks.extend(chunks)
                    logger.info(f"  Parsed {len(chunks)} chunk(s) from {file_path.relative_to(dir_path)}")
                except Exception as e:
                    logger.warning(f"Failed to read/parse {file_path}: {e}")
                    
        await ingest_chunks(all_chunks)


if __name__ == "__main__":
    # Fix event loop issues on Windows/macOS if any, and run main
    asyncio.run(main())
