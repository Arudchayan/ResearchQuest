import re

def fix_file(filepath):
    with open(filepath, "r") as f:
        content = f.read()

    # Note: Using generic label to avoid breaking styling or adding sr-only unless needed

    # 1. PapersView.tsx
    if "PapersView.tsx" in filepath:
        content = re.sub(
            r'<Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />\s*<input\s*ref=\{searchInputRef\}\s*type="text"\s*placeholder="Search library..."',
            r'<label htmlFor="papers-search-input" className="sr-only">Search library</label>\n            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />\n            <input\n              id="papers-search-input"\n              ref={searchInputRef}\n              type="text"\n              placeholder="Search library..."',
            content
        )

    # 2. TaskManager.tsx
    if "TaskManager.tsx" in filepath:
        content = re.sub(
            r'<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" aria-hidden="true" />\s*<input\s*ref=\{searchInputRef\}',
            r'<label htmlFor="task-search-input" className="sr-only">Search tasks</label>\n              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" aria-hidden="true" />\n              <input\n                id="task-search-input"\n                ref={searchInputRef}',
            content
        )

    # 3. NotesView.tsx
    if "NotesView.tsx" in filepath:
        content = re.sub(
            r'<Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />\s*<input\s*ref=\{searchInputRef\}\s*type="text"\s*placeholder="Search notes..."',
            r'<label htmlFor="notes-search-input" className="sr-only">Search notes</label>\n              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />\n              <input\n                id="notes-search-input"\n                ref={searchInputRef}\n                type="text"\n                placeholder="Search notes..."',
            content
        )

    # 4. TopicsView.tsx
    if "TopicsView.tsx" in filepath:
        content = re.sub(
            r'<Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />\s*<input\s*ref=\{searchInputRef\}\s*type="text"\s*placeholder="Search topics..."',
            r'<label htmlFor="topics-search-input" className="sr-only">Search topics</label>\n              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />\n              <input\n                id="topics-search-input"\n                ref={searchInputRef}\n                type="text"\n                placeholder="Search topics..."',
            content
        )

    # 5. IdeasBoard.tsx
    if "IdeasBoard.tsx" in filepath:
        content = re.sub(
            r'<Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />\s*<input\s*ref=\{searchInputRef\}\s*type="text"\s*placeholder="Search ideas..."',
            r'<label htmlFor="ideas-search-input" className="sr-only">Search ideas</label>\n            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />\n            <input\n              id="ideas-search-input"\n              ref={searchInputRef}\n              type="text"\n              placeholder="Search ideas..."',
            content
        )

    with open(filepath, "w") as f:
        f.write(content)

base = "researchquest/src/components/"
fix_file(base + "papers/PapersView.tsx")
fix_file(base + "tasks/TaskManager.tsx")
fix_file(base + "notes/NotesView.tsx")
fix_file(base + "topics/TopicsView.tsx")
fix_file(base + "ideas/IdeasBoard.tsx")
