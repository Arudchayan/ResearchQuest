import { useState, useEffect, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
import { Bold, Italic, Code, List, Link2, Save } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { supabase } from '../../lib/supabase'
import { awardXP, XP_REWARDS } from '../../utils/gamification'

export function MarkdownEditor() {
  const { selectedNote, setSelectedNote } = useAppStore()
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null)
    })
  }, [])
  
  // Load selected note
  useEffect(() => {
    if (selectedNote) {
      setContent(selectedNote.markdown_body)
      setTitle(selectedNote.title || '')
    } else {
      setContent('')
      setTitle('')
    }
  }, [selectedNote])
  
  // Auto-save with debounce
  useEffect(() => {
    if (!selectedNote || !userId) return
    
    const timer = setTimeout(async () => {
      await saveNote()
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [content, title])
  
  const saveNote = useCallback(async () => {
    if (!selectedNote || !userId) return
    
    setSaving(true)
    
    // Extract tags from content (words starting with #)
    const tagMatches = content.match(/#(\w+)/g)
    const tags = tagMatches ? [...new Set(tagMatches.map(tag => tag.slice(1)))] : []
    
    const { error } = await supabase
      .from('notes')
      .update({
        title: title || content.split('\n')[0]?.replace(/^#+ /, '').trim() || 'Untitled Note',
        markdown_body: content,
        tags,
      })
      .eq('id', selectedNote.id)
    
    if (!error) {
      // Award XP for updating
      await awardXP(userId, XP_REWARDS.UPDATE_NOTE, 'update_note')
      
      // Refresh the note in store
      const { data: updatedNote } = await supabase
        .from('notes')
        .select('*')
        .eq('id', selectedNote.id)
        .single()
      
      if (updatedNote) {
        setSelectedNote(updatedNote)
      }
    }
    
    setSaving(false)
  }, [selectedNote, userId, content, title])
  
  if (!selectedNote) {
    return (
      <div className="h-screen-dynamic flex items-center justify-center bg-bg-base">
        <div className="text-center text-text-tertiary">
          <p className="text-body">Select a note or create a new one to start editing</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="h-screen-dynamic flex flex-col bg-bg-base">
      {/* Title Input */}
      <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-bg-surface">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 text-title font-semibold bg-transparent border-none outline-none text-text-primary placeholder-text-tertiary"
          placeholder="Enter title..."
        />
        {saving && (
          <div className="flex items-center gap-2 text-small text-text-tertiary">
            <Save className="w-4 h-4 animate-pulse" />
            <span>Saving...</span>
          </div>
        )}
      </div>
      
      {/* Toolbar */}
      <div className="px-6 py-3 bg-bg-elevated border-b border-border-subtle flex items-center gap-2">
        <button className="p-2 hover:bg-bg-surface rounded-md transition-colors" title="Bold">
          <Bold className="w-4 h-4 text-text-secondary" />
        </button>
        <button className="p-2 hover:bg-bg-surface rounded-md transition-colors" title="Italic">
          <Italic className="w-4 h-4 text-text-secondary" />
        </button>
        <button className="p-2 hover:bg-bg-surface rounded-md transition-colors" title="Code">
          <Code className="w-4 h-4 text-text-secondary" />
        </button>
        <div className="w-px h-6 bg-border-subtle mx-1" />
        <button className="p-2 hover:bg-bg-surface rounded-md transition-colors" title="List">
          <List className="w-4 h-4 text-text-secondary" />
        </button>
        <button className="p-2 hover:bg-bg-surface rounded-md transition-colors" title="Link">
          <Link2 className="w-4 h-4 text-text-secondary" />
        </button>
      </div>
      
      {/* Split View - 60/40 ratio */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Pane - 60% width */}
        <div className="w-3/5 overflow-auto bg-bg-surface">
          <CodeMirror
            value={content}
            height="100%"
            extensions={[markdown()]}
            onChange={(value) => setContent(value)}
            className="h-full font-mono text-code"
          />
        </div>
        
        {/* Divider */}
        <div className="w-px bg-border-subtle flex-shrink-0" />
        
        {/* Preview Pane - 40% width */}
        <div className="w-2/5 overflow-auto bg-bg-base p-6">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize, rehypeHighlight]}
            >
              {content || '*Start typing to see preview...*'}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}
