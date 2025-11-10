import { Link2, Hash, Sparkles, CalendarCheck, Snowflake, Coffee, Flame, Heart } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useGamificationStore } from '../../store/gamificationStore'
import { formatTimeUntil, formatDateLabel } from '../../utils/time'

export function RightSidebar() {
  const { selectedNote, selectedPaper, selectedIdea, user } = useAppStore()
  const activeBoost = useGamificationStore((state) => state.activeBoost)
  const boostCountdown = useGamificationStore((state) => state.boostCountdown)
  const streakFreezeTokens = useGamificationStore((state) => state.streakFreezeTokens)
  const restDays = useGamificationStore((state) => state.restDays)
  const [todayXP, setTodayXP] = useState(0)
  const [weeklyPapers, setWeeklyPapers] = useState(0)
  const [activeIdeas, setActiveIdeas] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<{ id: string; title: string; due_date: string }[]>([])
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null)

      if (user?.id) {
        const userUuid = user.id

        // Fetch today's XP
        const today = new Date().toISOString().split('T')[0]
        supabase
          .from('daily_logs')
          .select('xp_earned')
          .eq('user_id', userUuid)
          .eq('date', today)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setTodayXP(data.xp_earned)
            } else {
              setTodayXP(0)
            }
          })

        // Fetch weekly papers count
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        supabase
          .from('papers')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userUuid)
          .gte('created_at', weekAgo.toISOString())
          .then(({ count }) => {
            setWeeklyPapers(count || 0)
          })

        // Fetch active ideas count
        supabase
          .from('ideas')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userUuid)
          .in('stage', ['Seed', 'Growing', 'Blooming'])
          .then(({ count }) => {
            setActiveIdeas(count || 0)
          })

        // Fetch upcoming deadlines (next 7 days)
        const now = new Date()
        const horizon = new Date()
        horizon.setDate(now.getDate() + 7)

        supabase
          .from('tasks')
          .select('id, title, due_date, status')
          .eq('user_id', userUuid)
          .neq('status', 'completed')
          .neq('status', 'done')
          .not('due_date', 'is', null)
          .gte('due_date', now.toISOString())
          .lte('due_date', horizon.toISOString())
          .order('due_date', { ascending: true })
          .limit(5)
          .then(({ data, error }) => {
            if (error) {
              console.error('Failed to load upcoming deadlines:', error)
              return
            }

            const tasks = (data as { id: string; title: string; due_date: string | null }[] | null) ?? []
            setUpcomingDeadlines(
              tasks
                .filter((item) => Boolean(item.due_date))
                .map((item) => ({
                  id: item.id,
                  title: item.title,
                  due_date: item.due_date as string,
                }))
            )
          })
      } else {
        setUpcomingDeadlines([])
      }
    })
  }, [])
  
  const hasSelection = selectedNote || selectedPaper || selectedIdea
  const nextDeadline = upcomingDeadlines[0]

  const gentleReminder = (() => {
    if (restDays > 0) {
      return `You still have ${restDays} rest day${restDays === 1 ? '' : 's'} to lean on. Listen to your energy and take one whenever you need it.`
    }

    if (streakFreezeTokens > 0) {
      return `Freeze tokens are on standby to protect your streak if life gets busy.`
    }

    if (activeBoost && boostCountdown) {
      return `Your ${activeBoost.label ?? 'focus boost'} is active for another ${boostCountdown}. Enjoy the flow!`
    }

    if (nextDeadline) {
      return `A tiny action toward "${nextDeadline.title}" counts. Choose the smallest next step and celebrate it.`
    }

    return 'Check in with yourself—resting, reflecting, or noodling on ideas all move the journey forward.'
  })()
  
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
        
        <div className="pt-4 border-t border-border-subtle space-y-4">
          <div className="p-4 bg-bg-elevated rounded-lg border border-border-subtle space-y-3">
            <div className="flex items-center gap-2 text-text-primary">
              <Sparkles className="w-4 h-4 text-primary-500" />
              <h3 className="text-small font-semibold uppercase tracking-wide">Today's wins</h3>
            </div>
            <div className="space-y-2 text-caption text-text-secondary">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary-500" />
                <span>+{todayXP} XP collected today</span>
              </div>
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-success" />
                <span>{user?.current_streak || 0} day streak · longest {user?.longest_streak || 0} days</span>
              </div>
              <p className="text-text-tertiary">
                This week: {weeklyPapers} paper{weeklyPapers === 1 ? '' : 's'} touched · {activeIdeas} idea{activeIdeas === 1 ? '' : 's'} simmering
              </p>
            </div>
          </div>

          <div className="p-4 bg-bg-elevated rounded-lg border border-border-subtle">
            <div className="flex items-center gap-2 text-text-primary">
              <CalendarCheck className="w-4 h-4 text-primary-500" />
              <h3 className="text-small font-semibold uppercase tracking-wide">Upcoming focus</h3>
            </div>
            {upcomingDeadlines.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {upcomingDeadlines.slice(0, 3).map((deadline) => (
                  <li key={deadline.id} className="text-caption bg-bg-base/60 rounded-md p-2 border border-border-subtle/60">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-text-primary truncate">{deadline.title}</span>
                      <span className="text-text-tertiary">{formatDateLabel(deadline.due_date)}</span>
                    </div>
                    <div className="text-text-secondary mt-1">
                      Due in {formatTimeUntil(deadline.due_date)} · choose one kind step forward.
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-caption text-text-secondary">
                No deadlines on the horizon this week. Follow your curiosity or take a restorative pause.
              </p>
            )}
          </div>

          <div className="p-4 bg-bg-elevated rounded-lg border border-border-subtle space-y-2">
            <div className="flex items-center gap-2 text-text-primary">
              <Snowflake className="w-4 h-4 text-primary-400" />
              <h3 className="text-small font-semibold uppercase tracking-wide">Energy tools</h3>
            </div>
            <div className="text-caption text-text-secondary space-y-1">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-primary-500 mt-0.5" />
                <span>
                  {activeBoost
                    ? `${activeBoost.label ?? 'Focus boost'} active${boostCountdown ? ` • ${boostCountdown} remaining` : ''}`
                    : 'Boosts are resting. Activate one when you want an intentional sprint.'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Coffee className="w-4 h-4 text-success mt-0.5" />
                <span>
                  {streakFreezeTokens} freeze token{streakFreezeTokens === 1 ? '' : 's'} · {restDays} rest day{restDays === 1 ? '' : 's'} ready to deploy.
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-bg-elevated rounded-lg border border-border-subtle">
            <div className="flex items-start gap-3 text-text-primary">
              <Heart className="w-5 h-5 text-primary-500 mt-0.5" />
              <div>
                <h3 className="text-small font-semibold uppercase tracking-wide">Gentle reminder</h3>
                <p className="mt-2 text-caption text-text-secondary leading-relaxed">{gentleReminder}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
