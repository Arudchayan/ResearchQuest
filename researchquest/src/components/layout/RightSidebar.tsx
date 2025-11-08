import { Link2, Clock, Hash, TrendingUp, BookOpen, Lightbulb, Target, Award } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export function RightSidebar() {
  const { selectedNote, selectedPaper, selectedIdea, user } = useAppStore()
  const [todayXP, setTodayXP] = useState(0)
  const [weeklyPapers, setWeeklyPapers] = useState(0)
  const [activeIdeas, setActiveIdeas] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null)
      
      if (user?.id) {
        // Fetch today's XP
        const today = new Date().toISOString().split('T')[0]
        supabase
          .from('daily_logs')
          .select('xp_earned')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setTodayXP(data.xp_earned)
            }
          })
        
        // Fetch weekly papers count
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        supabase
          .from('papers')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', weekAgo.toISOString())
          .then(({ count }) => {
            setWeeklyPapers(count || 0)
          })
        
        // Fetch active ideas count
        supabase
          .from('ideas')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .in('stage', ['Seed', 'Growing', 'Blooming'])
          .then(({ count }) => {
            setActiveIdeas(count || 0)
          })
      }
    })
  }, [])
  
  const hasSelection = selectedNote || selectedPaper || selectedIdea
  
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        {!hasSelection ? (
          <div className="text-center py-8 text-text-tertiary">
            <p className="text-small">Select an item to see details</p>
          </div>
        ) : (
          <>
            {/* Backlinks Panel */}
            <div>
              <h3 className="text-small font-semibold text-text-primary mb-2 flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Backlinks
              </h3>
              <div className="text-caption text-text-tertiary">
                No backlinks yet
              </div>
            </div>
            
            {/* Related Entities */}
            <div>
              <h3 className="text-small font-semibold text-text-primary mb-2 flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Related
              </h3>
              <div className="text-caption text-text-tertiary">
                No related items yet
              </div>
            </div>
          </>
        )}
        
        {/* Research Quick Stats */}
        <div className="pt-4 border-t border-border-subtle">
          <h3 className="text-small font-semibold text-text-primary mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Research Activity
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-bg-elevated rounded-md">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-primary-500" />
                <span className="text-caption text-text-secondary">Today's XP</span>
              </div>
              <span className="text-small font-semibold text-primary-500">+{todayXP}</span>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-bg-elevated rounded-md">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-500" />
                <span className="text-caption text-text-secondary">This Week</span>
              </div>
              <span className="text-small font-semibold text-text-primary">{weeklyPapers}</span>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-bg-elevated rounded-md">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                <span className="text-caption text-text-secondary">Active Ideas</span>
              </div>
              <span className="text-small font-semibold text-text-primary">{activeIdeas}</span>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-bg-elevated rounded-md">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-success" />
                <span className="text-caption text-text-secondary">Streak</span>
              </div>
              <span className="text-small font-semibold text-success">{user?.current_streak || 0} days</span>
            </div>
          </div>
        </div>
        
        {/* Recent Achievements */}
        <div className="pt-4 border-t border-border-subtle">
          <h3 className="text-small font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Award className="w-4 h-4" />
            Progress
          </h3>
          <div className="space-y-2">
            <div className="p-2 bg-bg-elevated rounded-md">
              <div className="flex items-center justify-between mb-1">
                <span className="text-caption text-text-secondary">Level {user?.current_level || 1}</span>
                <span className="text-caption text-text-tertiary">{user ? user.total_xp % 500 : 0}/500 XP</span>
              </div>
              <div className="w-full h-1.5 bg-bg-base rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-300"
                  style={{ width: `${user ? (user.total_xp % 500) / 500 * 100 : 0}%` }}
                />
              </div>
            </div>
            
            <div className="text-caption text-text-tertiary text-center py-2">
              Keep going! {500 - (user ? user.total_xp % 500 : 0)} XP to next level
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
