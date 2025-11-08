import { useState } from 'react'
import { Search, Plus, Loader, BookOpen, ExternalLink, CheckCircle2 } from 'lucide-react'
import type { CrossrefPaper } from '../../types/database'

interface AddPaperViewProps {
  onAdd: (paperData: any) => Promise<any>
  searchByDOI: (doi: string) => Promise<CrossrefPaper | null>
  searchByQuery: (query: string) => Promise<CrossrefPaper[]>
}

export function AddPaperView({ onAdd, searchByDOI, searchByQuery }: AddPaperViewProps) {
  const [activeTab, setActiveTab] = useState<'doi' | 'search' | 'manual'>('doi')
  const [doiInput, setDoiInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CrossrefPaper[]>([])
  const [doiResult, setDoiResult] = useState<CrossrefPaper | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  
  // Manual entry fields
  const [manualTitle, setManualTitle] = useState('')
  const [manualAuthors, setManualAuthors] = useState('')
  const [manualDoi, setManualDoi] = useState('')
  const [manualUrl, setManualUrl] = useState('')
  
  const handleDOISearch = async () => {
    if (!doiInput.trim()) return
    
    setLoading(true)
    setError('')
    setDoiResult(null)
    setSuccessMessage('')
    
    const result = await searchByDOI(doiInput.trim())
    
    if (result) {
      setDoiResult(result)
    } else {
      setError('Paper not found. Try manual entry or search by keywords.')
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
    
    try {
      const result = await onAdd(paperData)
      if (result) {
        setSuccessMessage('Paper added successfully! ✨ Check the sidebar to view it.')
        setDoiInput('')
        setDoiResult(null)
        setTimeout(() => setSuccessMessage(''), 4000)
      }
    } catch (error) {
      console.error('Failed to add paper:', error)
      setError(`Failed to add paper: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  const handleQuerySearch = async () => {
    if (!searchQuery.trim()) return
    
    setLoading(true)
    setError('')
    setSuccessMessage('')
    
    const results = await searchByQuery(searchQuery.trim())
    setSearchResults(results)
    
    if (results.length === 0) {
      setError('No papers found. Try different keywords or use manual entry.')
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
    
    try {
      const result = await onAdd(paperData)
      if (result) {
        setSuccessMessage('Paper added successfully! ✨ Check the sidebar to view it.')
        setSearchQuery('')
        setSearchResults([])
        setTimeout(() => setSuccessMessage(''), 4000)
      }
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
    
    try {
      const result = await onAdd(paperData)
      if (result) {
        setSuccessMessage('Paper added successfully! ✨ Check the sidebar to view it.')
        setManualTitle('')
        setManualAuthors('')
        setManualDoi('')
        setManualUrl('')
        setError('')
        setTimeout(() => setSuccessMessage(''), 4000)
      }
    } catch (error) {
      console.error('Failed to add paper:', error)
      setError(`Failed to add paper: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/20 rounded-lg">
            <BookOpen className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Add Paper to Library</h1>
            <p className="text-text-secondary mt-1">Search by DOI, keywords, or add manually</p>
          </div>
        </div>
      </div>
      
      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          <p className="text-green-800 dark:text-green-300 font-medium">{successMessage}</p>
        </div>
      )}
      
      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border-subtle">
        <button
          onClick={() => {
            setActiveTab('doi')
            setError('')
          }}
          className={`px-6 py-3 text-sm font-medium transition-all relative ${
            activeTab === 'doi'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          DOI Search
          {activeTab === 'doi' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('search')
            setError('')
          }}
          className={`px-6 py-3 text-sm font-medium transition-all relative ${
            activeTab === 'search'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Keyword Search
          {activeTab === 'search' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('manual')
            setError('')
          }}
          className={`px-6 py-3 text-sm font-medium transition-all relative ${
            activeTab === 'manual'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Manual Entry
          {activeTab === 'manual' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
          )}
        </button>
      </div>
      
      {/* Content */}
      <div className="bg-bg-surface rounded-lg border border-border-subtle shadow-sm p-6">
        {activeTab === 'doi' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-3">
                Enter DOI (Digital Object Identifier)
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={doiInput}
                  onChange={(e) => setDoiInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleDOISearch()}
                  placeholder="e.g., 10.1038/nature12373"
                  className="flex-1 px-4 py-3 bg-bg-base border border-border-subtle rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  onClick={handleDOISearch}
                  disabled={loading || !doiInput.trim()}
                  className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                >
                  {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  Search
                </button>
              </div>
              <p className="text-sm text-text-tertiary mt-2">
                Find papers using their unique DOI identifier
              </p>
            </div>
            
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
                {error}
              </div>
            )}
            
            {doiResult && (
              <div className="space-y-4">
                <div className="p-6 border-2 border-primary-500 rounded-lg bg-bg-elevated">
                  <div className="flex items-start gap-3 mb-3">
                    <BookOpen className="w-6 h-6 text-primary-500 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-text-primary mb-2">{doiResult.title}</h3>
                      <p className="text-sm text-text-secondary mb-3">
                        {doiResult.authors.slice(0, 5).join(', ')}
                        {doiResult.authors.length > 5 ? ', et al.' : ''}
                      </p>
                      <div className="flex flex-wrap gap-3 text-sm">
                        {doiResult.doi && (
                          <div className="flex items-center gap-2 text-text-tertiary">
                            <span className="font-medium">DOI:</span>
                            <span>{doiResult.doi}</span>
                          </div>
                        )}
                        {doiResult.publicationDate && (
                          <div className="flex items-center gap-2 text-text-tertiary">
                            <span className="font-medium">Year:</span>
                            <span>{doiResult.publicationDate}</span>
                          </div>
                        )}
                        {doiResult.sourceUrl && (
                          <a
                            href={doiResult.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary-500 hover:text-primary-600"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>View Source</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  {doiResult.abstract && (
                    <div className="mt-4 pt-4 border-t border-border-subtle">
                      <p className="text-sm text-text-secondary line-clamp-4">{doiResult.abstract}</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleAddDoiResult}
                  className="w-full px-6 py-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-semibold flex items-center justify-center gap-2 text-lg"
                >
                  <Plus className="w-6 h-6" />
                  Add Paper to Library
                </button>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'search' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-3">
                Search by Keywords or Title
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleQuerySearch()}
                  placeholder="e.g., CRISPR gene editing, quantum computing"
                  className="flex-1 px-4 py-3 bg-bg-base border border-border-subtle rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  onClick={handleQuerySearch}
                  disabled={loading || !searchQuery.trim()}
                  className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                >
                  {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  Search
                </button>
              </div>
              <p className="text-sm text-text-tertiary mt-2">
                Search research papers by topic, author, or keywords
              </p>
            </div>
            
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
                {error}
              </div>
            )}
            
            {searchResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-text-secondary">
                  Found {searchResults.length} papers - Click to add
                </p>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      onClick={() => handleSelectResult(result)}
                      className="p-4 border border-border-subtle rounded-lg hover:border-primary-500 hover:shadow-md cursor-pointer transition-all bg-bg-base"
                    >
                      <h4 className="font-semibold text-text-primary mb-2 hover:text-primary-600">
                        {result.title}
                      </h4>
                      <p className="text-sm text-text-secondary mb-2">
                        {result.authors.slice(0, 3).join(', ')}
                        {result.authors.length > 3 ? ', et al.' : ''}
                      </p>
                      <div className="flex gap-3 text-xs text-text-tertiary">
                        {result.doi && <span>DOI: {result.doi}</span>}
                        {result.publicationDate && <span>Year: {result.publicationDate}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'manual' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="Enter paper title"
                className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Authors <span className="text-text-tertiary">(comma separated)</span>
              </label>
              <input
                type="text"
                value={manualAuthors}
                onChange={(e) => setManualAuthors(e.target.value)}
                placeholder="John Doe, Jane Smith, et al."
                className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                DOI <span className="text-text-tertiary">(optional)</span>
              </label>
              <input
                type="text"
                value={manualDoi}
                onChange={(e) => setManualDoi(e.target.value)}
                placeholder="10.1038/nature12373"
                className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                URL <span className="text-text-tertiary">(optional)</span>
              </label>
              <input
                type="url"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
                {error}
              </div>
            )}
            
            <button
              onClick={handleManualAdd}
              disabled={!manualTitle.trim()}
              className="w-full px-6 py-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-semibold flex items-center justify-center gap-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-6 h-6" />
              Add Paper
            </button>
          </div>
        )}
      </div>
      
      {/* Help Card */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">💡 Tips</h3>
        <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
          <li>Use DOI search for the most accurate results</li>
          <li>Keyword search finds papers from CrossRef database</li>
          <li>Manual entry is perfect for papers without a DOI</li>
        </ul>
      </div>
    </div>
  )
}
