import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Trophy, Activity, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { dbService } from '../lib/dbService';
import { useAuth } from './AuthProvider';

interface Task {
  id: string;
  title: string;
  status: string;
  category: 'life' | 'household' | 'inbox' | 'routines';
  completedAt?: string;
}

interface WeeklyWinsProps {
  onClose: () => void;
}

const CATEGORY_COLORS = {
  life: '#3b82f6', // blue-500
  household: '#f97316', // orange-500
  inbox: '#6366f1', // indigo-500
  routines: '#10b981', // emerald-500
};

export function WeeklyWinsDashboard({ onClose }: WeeklyWinsProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const loadWins = async () => {
      try {
        const completedTasks = await dbService.getTasks(user.uid, 'completed');
        setTasks(completedTasks as Task[]);
      } catch (err) {
        console.error("Failed to fetch completed tasks:", err);
      } finally {
        setLoading(false);
      }
    };
    loadWins();
  }, [user]);

  const { chartData, groupedWins, totalWins } = useMemo(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentWins = tasks.filter((t) => {
      if (t.status !== 'completed' || !t.completedAt) return false;
      const completedDate = new Date(t.completedAt);
      return completedDate >= oneWeekAgo && completedDate <= new Date();
    });

    const categoryCounts: Record<string, number> = {
      life: 0,
      household: 0,
      inbox: 0,
      routines: 0,
    };

    const grouped: Record<string, Task[]> = {
      life: [],
      household: [],
      inbox: [],
      routines: []
    };

    recentWins.forEach((task) => {
      const cat = task.category || 'inbox';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(task);
    });

    const totalWins = recentWins.length;
    const chartData = Object.keys(categoryCounts)
      .map((key) => ({
        name: key,
        value: categoryCounts[key],
        percentage: totalWins > 0 ? Math.round((categoryCounts[key] / totalWins) * 100) : 0,
      }))
      .filter((data) => data.value > 0);

    return { chartData, groupedWins: grouped, totalWins };
  }, [tasks]);

  return (
    <div className="distraction-free min-h-screen pb-20">
      <header className="flex items-center gap-4 mb-8 pt-4">
        <button onClick={onClose} className="p-2 -ml-2 text-muted hover:text-content transition-colors rounded-full hover:bg-outline/30">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-light flex items-center gap-2">
            <Trophy size={24} className="text-yellow-500" />
            Weekly Wins
          </h2>
        </div>
      </header>

      {loading ? (
        <div className="text-center py-20 flex flex-col items-center gap-4">
          <Loader2 size={24} className="animate-spin text-muted" />
          <p className="text-muted font-light">Compiling your achievements...</p>
        </div>
      ) : totalWins === 0 ? (
        <div className="text-center py-20 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-surface border border-outline flex items-center justify-center opacity-50">
            <Activity size={24} className="text-muted" />
          </div>
          <p className="text-muted font-light">No tasks completed in the last 7 days.</p>
          <p className="text-sm text-muted/60">Time to start building momentum!</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
          <section className="bg-surface border border-outline rounded-2xl p-6">
            <h3 className="text-sm font-semibold tracking-wide text-muted uppercase mb-6 text-center">
              Effort Distribution ({totalWins} total)
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.inbox} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--outline)', borderRadius: '8px', color: 'var(--content)' }}
                    itemStyle={{ color: 'var(--content)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="flex flex-wrap justify-center gap-4 mt-6">
              {chartData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[d.name as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.inbox }} />
                  <span className="text-sm font-medium capitalize text-content">{d.name}</span>
                  <span className="text-xs text-muted">({d.percentage}%)</span>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <h3 className="text-lg font-medium tracking-tight">Recent Accomplishments</h3>
            
            {Object.entries(groupedWins).map(([category, items]) => {
              const taskItems = items as any[];
              if (taskItems.length === 0) return null;
              
              const colorClass = 
                category === 'life' ? 'text-blue-500' :
                category === 'household' ? 'text-orange-500' :
                category === 'routines' ? 'text-emerald-500' : 'text-indigo-500';
                
              return (
                <div key={category} className="space-y-3">
                  <h4 className={`text-xs font-semibold tracking-wider uppercase flex items-center gap-2 ${colorClass}`}>
                    {category} <span className="bg-surface border border-outline px-1.5 py-0.5 rounded-full text-[10px] text-content">{taskItems.length}</span>
                  </h4>
                  <ul className="space-y-1">
                    {taskItems.map(task => (
                      <li key={task.id} className="flex items-start gap-3 bg-surface/50 border border-outline border-dashed rounded-lg p-3">
                        <Trophy size={14} className="mt-0.5 text-muted shrink-0" />
                        <span className="text-sm text-content/90 font-light leading-relaxed">{task.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        </motion.div>
      )}
    </div>
  );
}
