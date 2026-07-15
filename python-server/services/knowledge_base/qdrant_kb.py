"""Qdrant vector search implementation of the KB service.

Prerequisites:
  - Qdrant running locally or on cloud
  - KB_PROVIDER=qdrant in .env
  - QDRANT_URL=http://localhost:6333
  - QDRANT_API_KEY=... (for Qdrant Cloud)
  - KB_COLLECTION=knowledge_base
  - Install: uv add qdrant-client fastembed
"""

from typing import List

import httpx
from loguru import logger

from env_config import settings
from services.knowledge_base.base import BaseKnowledgeBaseService, KBResult

EMBEDDING_MODEL = "text-embedding-3-small"


class QdrantKBService(BaseKnowledgeBaseService):
    """Knowledge base backed by Qdrant vector search."""

    def _get_qdrant_client(self):
        try:
            from qdrant_client import AsyncQdrantClient
        except ImportError:
            raise ImportError("qdrant-client not installed. Run: uv add qdrant-client")

        return AsyncQdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key or None,
        )

    async def _get_embedding(self, text: str) -> list[float]:
        """Get dense embedding from OpenRouter API."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json={"model": EMBEDDING_MODEL, "input": text},
                timeout=10.0,
            )
            resp.raise_for_status()
            return resp.json()["data"][0]["embedding"]

    def _get_sparse_embedding(self, text: str):
        """Get sparse BM25 embedding using fastembed."""
        try:
            from fastembed import SparseTextEmbedding
            # This loads locally and generates sparse vector instantly
            model = SparseTextEmbedding("Qdrant/bm25")
            return list(model.embed([text]))[0]
        except Exception as e:
            logger.warning(f"[kb_qdrant] Failed to generate sparse embedding: {e}")
            return None

    async def search(self, query: str, top_k: int = 5) -> List[KBResult]:
        try:
            dense_embedding = await self._get_embedding(query)
        except Exception as e:
            logger.warning(f"[kb_qdrant] Dense embedding failed: {e}")
            return []
            
        sparse_embedding = self._get_sparse_embedding(query)

        try:
            client = self._get_qdrant_client()
            from qdrant_client.models import Prefetch, SparseVector, FusionQuery, Fusion
            
            prefetch = []
            # Prefetch for Dense Vector Search
            prefetch.append(
                Prefetch(
                    query=dense_embedding,
                    using="dense",
                    limit=top_k * 2,
                )
            )
            
            # Prefetch for Sparse BM25 Search
            if sparse_embedding:
                prefetch.append(
                    Prefetch(
                        query=SparseVector(
                            indices=sparse_embedding.indices.tolist(),
                            values=sparse_embedding.values.tolist()
                        ),
                        using="bm25",
                        limit=top_k * 2,
                    )
                )

            # Perform Hybrid Search using Reciprocal Rank Fusion (RRF)
            response = await client.query_points(
                collection_name=settings.kb_collection,
                prefetch=prefetch,
                query=FusionQuery(fusion=Fusion.RRF),
                limit=top_k,
            )
            hits = response.points
        except Exception as e:
            logger.warning(f"[kb_qdrant] Hybrid search failed: {e}")
            return []

        # --- Small-to-Big (Windowed) Retrieval ---
        # Fetch the current, previous, and next chunks for all top hits to provide context
        target_chunks = set()
        hit_scores = {}
        for hit in hits:
            payload = hit.payload or {}
            file_name = payload.get("file_name")
            chunk_index = payload.get("chunk_index")
            if file_name and chunk_index is not None:
                target_chunks.add((file_name, chunk_index - 1))
                target_chunks.add((file_name, chunk_index))
                target_chunks.add((file_name, chunk_index + 1))
                # Save max score for the file to pass to KBResult
                hit_scores[file_name] = max(hit_scores.get(file_name, 0.0), hit.score or 1.0)
        
        results = []
        if target_chunks:
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            
            should_conditions = []
            for fname, cindex in target_chunks:
                # We only fetch positive indices
                if cindex >= 0:
                    should_conditions.append(
                        Filter(
                            must=[
                                FieldCondition(key="file_name", match=MatchValue(value=fname)),
                                FieldCondition(key="chunk_index", match=MatchValue(value=cindex))
                            ]
                        )
                    )
            
            try:
                # Scroll to fetch the expanded chunk set
                scroll_resp = await client.scroll(
                    collection_name=settings.kb_collection,
                    scroll_filter=Filter(should=should_conditions),
                    limit=len(should_conditions),
                    with_payload=True,
                    with_vectors=False
                )
                all_records = scroll_resp[0]
                
                # Group by file_name
                from collections import defaultdict
                grouped_records = defaultdict(list)
                for rec in all_records:
                    payload = rec.payload or {}
                    grouped_records[payload.get("file_name")].append(payload)
                
                # Merge contiguous blocks
                for fname, payloads in grouped_records.items():
                    payloads.sort(key=lambda p: p.get("chunk_index", 0))
                    
                    current_block = []
                    for p in payloads:
                        if not current_block:
                            current_block.append(p)
                        else:
                            # If chunks are sequential, merge them
                            if p.get("chunk_index") == current_block[-1].get("chunk_index", -1) + 1:
                                current_block.append(p)
                            else:
                                # Break block and finalize
                                merged_text = "\n\n...\n\n".join([cp.get("text", "") for cp in current_block])
                                results.append(KBResult(
                                    content=merged_text,
                                    source=current_block[0].get("source", fname),
                                    score=hit_scores.get(fname, 1.0)
                                ))
                                current_block = [p]
                    
                    if current_block:
                        merged_text = "\n\n...\n\n".join([cp.get("text", "") for cp in current_block])
                        results.append(KBResult(
                            content=merged_text,
                            source=current_block[0].get("source", fname),
                            score=hit_scores.get(fname, 1.0)
                        ))
                        
                logger.info(f"[kb_qdrant] Windowed retrieval merged {len(all_records)} chunks into {len(results)} contiguous contexts.")
                
                # Sort results descending by score
                results.sort(key=lambda r: r.score, reverse=True)
                return results
                
            except Exception as e:
                logger.warning(f"[kb_qdrant] Failed windowed retrieval: {e}. Falling back to standard search results.")

        # Fallback to direct hits if windowed retrieval failed or target_chunks was empty
        for hit in hits:
            payload = hit.payload or {}
            results.append(
                KBResult(
                    content=payload.get("text", ""),
                    source=payload.get("source", settings.kb_collection),
                    score=hit.score or 1.0,
                )
            )

        logger.info(f"[kb_qdrant] '{query}' → {len(results)} result(s)")
        return results
