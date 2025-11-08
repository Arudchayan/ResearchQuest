import { useState } from 'react'
import { X, Search, Plus, Loader } from 'lucide-react'
import type { CrossrefPaper } from '../../types/database'

interface AddPaperModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (paperData: any) => void
  searchByDOI: (doi: string) => Promise<CrossrefPaper | null>
  searchByQuery: (query: string) => Promise<CrossrefPaper[]>
}

export function AddPaperModal({ isOpen, onClose, onAdd, searchByDOI, searchByQuery }: AddPaperModalProps) {
  const [activeTab, setActiveTab] = useState<'doi' | 'search' | 'manual'>('doi')
  const [doiInput, setDoiInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CrossrefPaper[]>([])
  const [doiResult, setDoiResult] = useState<CrossrefPaper | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Manual entry fields
  const [manualTitle, setManualTitle] = useState('')
  const [manualAuthors, setManualAuthors] = useState('')
  const [manualDoi, setManualDoi] = useState('')
  const [manualUrl, setManualUrl] = useState('')
  
  if (!isOpen) return null
  
  const handleDOISearch = async () => {
    if (!doiInput.trim()) return
    
    setLoading(true)
    setError('')
    setDoiResult(null)
    
    const result = await searchByDOI(doiInput.trim())
    
    if (result) {
      setDoiResult(result)
    } else {
      setError('Paper not found. Try manual entry.')
    }
    
    setLoading(false)
  }
  
  const handleAddDoiResult = async () => {
    if (!doiResult) return
    
    const paperData = {
      title: doiResult.title,
      authors: Array.isArray(doiResult.authors) ? doiResult.authors : [],
      doi: doiResult.doi,
      source_url: doiResult.sourceUrl,
      abstract: doiResult.abstract,
      publication_date: doiResult.publicationDate?.toString(),
    }
    
    console.log('Adding paper via DOI:', paperData)
    
    try {
      await onAdd(paperData)
      console.log('Paper added successfully')
      handleClose()
    } catch (error) {
      console.error('Failed to add paper:', error)
      setError(`Failed to add paper: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  const handleQuerySearch = async () => {
    if (!searchQuery.trim()) return
    
    setLoading(true)
    setError('')
    
    const results = await searchByQuery(searchQuery.trim())
    setSearchResults(results)
    
    if (results.length === 0) {
      setError('No papers found. Try different keywords.')
    }
    
    setLoading(false)
  }
  
  const handleSelectResult = async (result: CrossrefPaper) => {
    const paperData = {
      title: result.title,
      authors: Array.isArray(result.authors) ? result.authors : [],
      doi: result.doi,
      source_url: result.sourceUrl,
      abstract: result.abstract,
      publication_date: result.publicationDate?.toString(),
    }
    
    console.log('Adding paper via search selection:', paperData)
    
    try {
      await onAdd(paperData)
      console.log('Paper added successfully')
      handleClose()
    } catch (error) {
      console.error('Failed to add paper:', error)
      setError(`Failed to add paper: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  const handleManualAdd = async () => {
    if (!manualTitle.trim()) {
      setError('Title is required')
      return
    }
    
    const paperData = {
      title: manualTitle,
      authors: manualAuthors.split(',').map(a => a.trim()).filter(Boolean),
      doi: manualDoi || undefined,
      source_url: manualUrl || undefined,
    }
    
    console.log('Adding paper via manual entry:', paperData)
    
    try {
      await onAdd(paperData)
      console.log('Paper added successfully')
      handleClose()
    } catch (error) {
      console.error('Failed to add paper:', error)
      setError(`Failed to add paper: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  const handleClose = () => {
    setDoiInput('')
    setSearchQuery('')
    setSearchResults([])
    setDoiResult(null)
    setManualTitle('')
    setManualAuthors('')
    setManualDoi('')
    setManualUrl('')
    setError('')
    onClose()
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-surface rounded-lg shadow-lg border border-border-subtle max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-subtle">
          <h2 className="text-title font-semibold text-text-primary">Add Paper</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-bg-elevated rounded transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-border-subtle">
          <button
            onClick={() => setActiveTab('doi')}
            className={`px-6 py-3 text-small font-medium transition-colors ${
              activeTab === 'doi'
                ? 'text-primary-500 border-b-2 border-primary-500'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            DOI Search
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-6 py-3 text-small font-medium transition-colors ${
              activeTab === 'search'
                ? 'text-primary-500 border-b-2 border-primary-500'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Search
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-6 py-3 text-small font-medium transition-colors ${
              activeTab === 'manual'
                ? 'text-primary-500 border-b-2 border-primary-500'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Manual Entry
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'doi' && (
            <div className="space-y-4">
              <div>
                <label className="block text-small font-medium text-text-primary mb-2">
                  Enter DOI
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={doiInput}
                    onChange={(e) => setDoiInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleDOISearch()}
                    placeholder="10.1038/nature12373"
                    className="flex-1 px-4 py-2 bg-bg-base border border-border-subtle rounded-md text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={handleDOISearch}
                    disabled={loading || !doiInput.trim()}
                    className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Search
                  </button>
                </div>
              </div>
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-small rounded-md">
                  {error}
                </div>
              )}
              {doiResult && (
                <div className="space-y-3">
                  <div className="p-4 border border-border-subtle rounded-md bg-bg-elevated">
                    <h4 className="font-medium text-text-primary mb-2">{doiResult.title}</h4>
                    <p className="text-small text-text-secondary mb-2">
                      {doiResult.authors.slice(0, 3).join(', ')}{doiResult.authors.length > 3 ? ', et al.' : ''}
                    </p>
                    {doiResult.doi && (
                      <p className="text-caption text-text-tertiary">DOI: {doiResult.doi}</p>
                    )}
                    {doiResult.publicationDate && (
                      <p className="text-caption text-text-tertiary">Year: {doiResult.publicationDate}</p>
                    )}
                  </div>
                  <button
                    onClick={handleAddDoiResult}
                    className="w-full px-4 py-3 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add Paper to Library
                  </button>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'search' && (
            <div className="space-y-4">
              <div>
                <label className="block text-small font-medium text-text-primary mb-2">
                  Search Query
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleQuerySearch()}
                    placeholder="CRISPR gene editing"
                    className="flex-1 px-4 py-2 bg-bg-base border border-border-subtle rounded-md text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={handleQuerySearch}
                    disabled={loading || !searchQuery.trim()}
                    className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Search
                  </button>
                </div>
              </div>
              
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      className="p-4 border border-border-subtle rounded-md hover:border-primary-500 cursor-pointer transition-colors"
                      onClick={() => handleSelectResult(result)}
                    >
                      <h4 className="font-medium text-text-primary mb-1">{result.title}</h4>
                      <p className="text-small text-text-secondary">
                        {result.authors.slice(0, 3).join(', ')}{result.authors.length > 3 ? ', et al.' : ''}
                      </p>
                      {result.doi && (
                        <p className="text-caption text-text-tertiary mt-1">DOI: {result.doi}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-small rounded-md">
                  {error}
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div>
                <label className="block text-small font-medium text-text-primary mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-bg-base border border-border-subtle rounded-md text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-small font-medium text-text-primary mb-2">
                  Authors (comma separated)
                </label>
                <input
                  type="text"
                  value={manualAuthors}
                  onChange={(e) => setManualAuthors(e.target.value)}
                  placeholder="John Doe, Jane Smith"
                  className="w-full px-4 py-2 bg-bg-base border border-border-subtle rounded-md text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-small font-medium text-text-primary mb-2">
                  DOI (optional)
                </label>
                <input
                  type="text"
                  value={manualDoi}
                  onChange={(e) => setManualDoi(e.target.value)}
                  placeholder="10.1038/nature12373"
                  className="w-full px-4 py-2 bg-bg-base border border-border-subtle rounded-md text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-small font-medium text-text-primary mb-2">
                  URL (optional)
                </label>
                <input
                  type="url"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2 bg-bg-base border border-border-subtle rounded-md text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-small rounded-md">
                  {error}
                </div>
              )}
              
              <button
                onClick={handleManualAdd}
                className="w-full px-4 py-3 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Paper
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
