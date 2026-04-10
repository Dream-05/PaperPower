import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import hashlib


@dataclass
class MemoryEntry:
    id: str
    content: str
    language: str
    timestamp: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    summary: Optional[str] = None
    keywords: List[str] = field(default_factory=list)
    linked_ids: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "content": self.content,
            "language": self.language,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
            "summary": self.summary,
            "keywords": self.keywords,
            "linked_ids": self.linked_ids,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MemoryEntry":
        return cls(
            id=data["id"],
            content=data["content"],
            language=data["language"],
            timestamp=data["timestamp"],
            metadata=data.get("metadata", {}),
            summary=data.get("summary"),
            keywords=data.get("keywords", []),
            linked_ids=data.get("linked_ids", []),
        )


class BilingualMemory:
    def __init__(self, storage_path: Optional[str] = None, max_entries: int = 1000):
        self.storage_path = Path(storage_path) if storage_path else None
        self.max_entries = max_entries
        self.zh_memories: Dict[str, MemoryEntry] = {}
        self.en_memories: Dict[str, MemoryEntry] = {}
        self.cross_links: Dict[str, List[str]] = {}

        if self.storage_path:
            self._load_from_storage()

    def _generate_id(self, content: str) -> str:
        timestamp = datetime.now().isoformat()
        hash_input = f"{content}_{timestamp}".encode("utf-8")
        return hashlib.md5(hash_input).hexdigest()[:12]

    def _extract_keywords(self, content: str, language: str) -> List[str]:
        if language == "zh":
            pattern = r'[\u4e00-\u9fff]{2,4}'
            matches = re.findall(pattern, content)
        else:
            pattern = r'\b[a-zA-Z]{3,}\b'
            matches = re.findall(pattern, content)

        keyword_count = {}
        for word in matches:
            keyword_count[word] = keyword_count.get(word, 0) + 1

        sorted_keywords = sorted(keyword_count.items(), key=lambda x: -x[1])
        return [k for k, _ in sorted_keywords[:10]]

    def _summarize(self, content: str, max_length: int = 100) -> str:
        if len(content) <= max_length:
            return content
        return content[:max_length] + "..."

    def add_memory(
        self,
        content: str,
        language: str,
        metadata: Optional[Dict[str, Any]] = None,
        summary: Optional[str] = None,
    ) -> MemoryEntry:
        entry_id = self._generate_id(content)
        timestamp = datetime.now().isoformat()

        keywords = self._extract_keywords(content, language)
        if not summary:
            summary = self._summarize(content)

        entry = MemoryEntry(
            id=entry_id,
            content=content,
            language=language,
            timestamp=timestamp,
            metadata=metadata or {},
            summary=summary,
            keywords=keywords,
        )

        if language == "zh":
            self.zh_memories[entry_id] = entry
            self._cleanup_memories(self.zh_memories)
        else:
            self.en_memories[entry_id] = entry
            self._cleanup_memories(self.en_memories)

        if self.storage_path:
            self._save_to_storage()

        return entry

    def _cleanup_memories(self, memory_dict: Dict[str, MemoryEntry]):
        if len(memory_dict) > self.max_entries:
            sorted_entries = sorted(
                memory_dict.items(),
                key=lambda x: x[1].timestamp
            )
            for entry_id, _ in sorted_entries[:len(memory_dict) - self.max_entries]:
                del memory_dict[entry_id]

    def link_memories(self, zh_id: str, en_id: str):
        if zh_id in self.zh_memories and en_id in self.en_memories:
            self.zh_memories[zh_id].linked_ids.append(en_id)
            self.en_memories[en_id].linked_ids.append(zh_id)

            if zh_id not in self.cross_links:
                self.cross_links[zh_id] = []
            self.cross_links[zh_id].append(en_id)

            if en_id not in self.cross_links:
                self.cross_links[en_id] = []
            self.cross_links[en_id].append(zh_id)

    def search(
        self,
        query: str,
        query_language: str,
        limit: int = 5,
        cross_lingual: bool = True,
    ) -> List[Tuple[MemoryEntry, float]]:
        results = []
        query_lower = query.lower()
        query_keywords = set(self._extract_keywords(query, query_language))

        primary_memories = (
            self.zh_memories if query_language == "zh" else self.en_memories
        )

        for entry in primary_memories.values():
            score = self._calculate_relevance(entry, query_lower, query_keywords)
            if score > 0:
                results.append((entry, score))

        if cross_lingual and len(results) < limit:
            secondary_memories = (
                self.en_memories if query_language == "zh" else self.zh_memories
            )

            for entry in secondary_memories.values():
                score = self._calculate_relevance(entry, query_lower, query_keywords)
                if score > 0:
                    for linked_id in entry.linked_ids:
                        if linked_id in primary_memories:
                            linked_entry = primary_memories[linked_id]
                            linked_score = self._calculate_relevance(
                                linked_entry, query_lower, query_keywords
                            )
                            if linked_score > 0:
                                results.append((linked_entry, linked_score * 0.8))
                            break
                    results.append((entry, score * 0.7))

        results.sort(key=lambda x: -x[1])
        return results[:limit]

    def _calculate_relevance(
        self,
        entry: MemoryEntry,
        query_lower: str,
        query_keywords: set,
    ) -> float:
        score = 0.0

        content_lower = entry.content.lower()
        summary_lower = (entry.summary or "").lower()

        if query_lower in content_lower:
            score += 2.0
        if query_lower in summary_lower:
            score += 1.5

        for keyword in entry.keywords:
            if keyword.lower() in query_lower:
                score += 0.5

        keyword_overlap = len(set(k.lower() for k in entry.keywords) & query_keywords)
        score += keyword_overlap * 0.3

        return score

    def get_context(
        self,
        query: str,
        language: str,
        max_tokens: int = 2000,
    ) -> str:
        results = self.search(query, language, limit=10)

        context_parts = []
        current_tokens = 0

        for entry, score in results:
            entry_text = f"[{entry.language.upper()}] {entry.summary or entry.content}"
            entry_tokens = len(entry_text) // 2

            if current_tokens + entry_tokens > max_tokens:
                break

            context_parts.append(entry_text)
            current_tokens += entry_tokens

        if not context_parts:
            return ""

        return "\n---\n".join(context_parts)

    def get_recent(self, language: Optional[str] = None, limit: int = 5) -> List[MemoryEntry]:
        if language == "zh":
            memories = list(self.zh_memories.values())
        elif language == "en":
            memories = list(self.en_memories.values())
        else:
            memories = list(self.zh_memories.values()) + list(self.en_memories.values())

        memories.sort(key=lambda x: x.timestamp, reverse=True)
        return memories[:limit]

    def clear(self, language: Optional[str] = None):
        if language == "zh":
            self.zh_memories.clear()
        elif language == "en":
            self.en_memories.clear()
        else:
            self.zh_memories.clear()
            self.en_memories.clear()
            self.cross_links.clear()

        if self.storage_path:
            self._save_to_storage()

    def _save_to_storage(self):
        if not self.storage_path:
            return

        self.storage_path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            "zh_memories": {k: v.to_dict() for k, v in self.zh_memories.items()},
            "en_memories": {k: v.to_dict() for k, v in self.en_memories.items()},
            "cross_links": self.cross_links,
        }

        with open(self.storage_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_from_storage(self):
        if not self.storage_path or not self.storage_path.exists():
            return

        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            self.zh_memories = {
                k: MemoryEntry.from_dict(v) for k, v in data.get("zh_memories", {}).items()
            }
            self.en_memories = {
                k: MemoryEntry.from_dict(v) for k, v in data.get("en_memories", {}).items()
            }
            self.cross_links = data.get("cross_links", {})
        except (json.JSONDecodeError, KeyError):
            pass

    def get_stats(self) -> Dict[str, Any]:
        return {
            "zh_count": len(self.zh_memories),
            "en_count": len(self.en_memories),
            "cross_links_count": len(self.cross_links),
            "total_count": len(self.zh_memories) + len(self.en_memories),
        }


class ConversationMemory:
    def __init__(self, max_turns: int = 20):
        self.max_turns = max_turns
        self.turns: List[Dict[str, Any]] = []

    def add_turn(
        self,
        user_input: str,
        assistant_response: str,
        language: str,
        tools_used: Optional[List[str]] = None,
    ):
        turn = {
            "timestamp": datetime.now().isoformat(),
            "user": user_input,
            "assistant": assistant_response,
            "language": language,
            "tools_used": tools_used or [],
        }
        self.turns.append(turn)

        if len(self.turns) > self.max_turns:
            self.turns = self.turns[-self.max_turns:]

    def get_context(self, max_turns: Optional[int] = None) -> str:
        turns_to_use = self.turns[-max_turns:] if max_turns else self.turns

        context_parts = []
        for turn in turns_to_use:
            context_parts.append(f"用户: {turn['user']}")
            context_parts.append(f"助手: {turn['assistant']}")

        return "\n".join(context_parts)

    def get_last_language(self) -> Optional[str]:
        if self.turns:
            return self.turns[-1].get("language")
        return None

    def clear(self):
        self.turns.clear()

    def to_dict(self) -> List[Dict[str, Any]]:
        return self.turns

    @classmethod
    def from_dict(cls, data: List[Dict[str, Any]]) -> "ConversationMemory":
        memory = cls()
        memory.turns = data
        return memory


class MemoryManager:
    def __init__(
        self,
        storage_path: Optional[str] = None,
        max_long_term: int = 1000,
        max_conversation_turns: int = 20,
    ):
        self.long_term = BilingualMemory(storage_path, max_long_term)
        self.conversation = ConversationMemory(max_conversation_turns)

    def add_interaction(
        self,
        user_input: str,
        assistant_response: str,
        language: str,
        tools_used: Optional[List[str]] = None,
        store_long_term: bool = False,
    ):
        self.conversation.add_turn(user_input, assistant_response, language, tools_used)

        if store_long_term:
            self.long_term.add_memory(
                content=f"用户: {user_input}\n助手: {assistant_response}",
                language=language,
                metadata={"tools_used": tools_used or []},
            )

    def get_relevant_context(
        self,
        query: str,
        language: str,
        include_conversation: bool = True,
        include_long_term: bool = True,
    ) -> str:
        parts = []

        if include_conversation:
            conv_context = self.conversation.get_context(max_turns=5)
            if conv_context:
                parts.append(f"=== 最近对话 ===\n{conv_context}")

        if include_long_term:
            lt_context = self.long_term.get_context(query, language)
            if lt_context:
                parts.append(f"=== 相关记忆 ===\n{lt_context}")

        return "\n\n".join(parts) if parts else ""

    def search_memories(
        self,
        query: str,
        language: str,
        limit: int = 5,
    ) -> List[Tuple[MemoryEntry, float]]:
        return self.long_term.search(query, language, limit)

    def clear_all(self):
        self.long_term.clear()
        self.conversation.clear()

    def get_stats(self) -> Dict[str, Any]:
        return {
            "long_term": self.long_term.get_stats(),
            "conversation_turns": len(self.conversation.turns),
        }
