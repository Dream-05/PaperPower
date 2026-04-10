import * as React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
  status?: 'pending' | 'sent' | 'error';
}

interface Attachment {
  type: 'image' | 'file' | 'link';
  url: string;
  name?: string;
  thumbnail?: string;
}

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (content: string, attachments?: Attachment[]) => void;
  onRegenerate?: (messageId: string) => void;
  onCopy?: (content: string) => void;
  onInsert?: (content: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  showHistory?: boolean;
  historyItems?: HistoryItem[];
  onSelectHistory?: (itemId: string) => void;
  toolbarButtons?: ToolbarButton[];
}

interface HistoryItem {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  type: 'document' | 'spreadsheet' | 'presentation';
}

interface ToolbarButton {
  id: string;
  icon: string;
  label: string;
  onClick: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  onRegenerate,
  onCopy,
  onInsert,
  placeholder = '输入您的问题或需求...',
  isLoading = false,
  showHistory = true,
  historyItems = [],
  onSelectHistory,
  toolbarButtons = [],
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  }, [inputValue, isLoading, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const url = URL.createObjectURL(file);
          onSendMessage('上传了一张图片', [{ type: 'image', url, name: file.name }]);
        }
        break;
      }
    }
  }, [onSendMessage]);

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    return (
      <div
        key={message.id}
        className={`message ${isUser ? 'user-message' : isSystem ? 'system-message' : 'assistant-message'}`}
      >
        <div className="message-avatar">
          {isUser ? '👤' : isSystem ? '⚙️' : '🤖'}
        </div>
        <div className="message-content">
          <div className="message-text">{message.content}</div>
          {message.attachments && message.attachments.length > 0 && (
            <div className="message-attachments">
              {message.attachments.map((att, i) => (
                <div key={i} className="attachment">
                  {att.type === 'image' && (
                    <img src={att.url} alt={att.name} className="attachment-image" />
                  )}
                  {att.type === 'file' && (
                    <a href={att.url} className="attachment-file">📎 {att.name}</a>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="message-footer">
            <span className="message-time">
              {message.timestamp.toLocaleTimeString()}
            </span>
            {!isUser && !isSystem && (
              <div className="message-actions">
                {onCopy && (
                  <button onClick={() => onCopy(message.content)} title="复制">
                    📋
                  </button>
                )}
                {onInsert && (
                  <button onClick={() => onInsert(message.content)} title="插入文档">
                    📝
                  </button>
                )}
                {onRegenerate && (
                  <button onClick={() => onRegenerate(message.id)} title="重新生成">
                    🔄
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="chat-interface">
      {showHistory && (
        <div className={`history-panel ${isHistoryExpanded ? 'expanded' : ''}`}>
          <div className="history-header" onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}>
            <span>📜 历史记录</span>
            <span className="history-toggle">{isHistoryExpanded ? '▼' : '▶'}</span>
          </div>
          {isHistoryExpanded && (
            <div className="history-list">
              {historyItems.length === 0 ? (
                <div className="history-empty">暂无历史记录</div>
              ) : (
                historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="history-item"
                    onClick={() => onSelectHistory?.(item.id)}
                  >
                    <div className="history-item-icon">
                      {item.type === 'document' && '📄'}
                      {item.type === 'spreadsheet' && '📊'}
                      {item.type === 'presentation' && '📽️'}
                    </div>
                    <div className="history-item-content">
                      <div className="history-item-title">{item.title}</div>
                      <div className="history-item-preview">{item.preview}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <div className="empty-text">开始对话，让AI帮助您</div>
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        {isLoading && (
          <div className="message assistant-message">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        {toolbarButtons.length > 0 && (
          <div className="toolbar">
            {toolbarButtons.map((btn) => (
              <button key={btn.id} onClick={btn.onClick} title={btn.label}>
                {btn.icon}
              </button>
            ))}
          </div>
        )}
        <div className="input-container">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            rows={3}
            disabled={isLoading}
          />
          <button
            className="send-button"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
