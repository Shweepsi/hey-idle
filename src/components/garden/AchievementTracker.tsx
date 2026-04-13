import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAchievements } from '@/hooks/useAchievements';
import { Trophy, Star, Award } from 'lucide-react';

/**
 * Achievement tracker component showing progress towards various game achievements
 */
export const AchievementTracker = () => {
  const { achievements, isLoading } = useAchievements();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Succès
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  const completedCount = achievements.filter((a) => a.completed).length;
  const totalCount = achievements.length;
  const completionPercentage =
    totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Succès
        </CardTitle>
        <CardDescription>
          {completedCount}/{totalCount} complétés (
          {Math.round(completionPercentage)}%)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Progress value={completionPercentage} className="h-2" />
          <div className="text-xs text-center text-muted-foreground">
            Progression globale
          </div>
        </div>

        <div className="space-y-3">
          {achievements.map((achievement) => (
            <div
              key={achievement.id}
              className={`border rounded-lg p-3 ${achievement.completed ? 'bg-muted/50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{achievement.emoji}</span>
                  <div>
                    <h4 className="font-medium">{achievement.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {achievement.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {achievement.completed ? (
                    <Badge
                      variant="default"
                      className="bg-green-100 text-green-800"
                    >
                      <Award className="h-3 w-3 mr-1" />
                      Complété
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      {achievement.progress || 0}/{achievement.target}
                    </Badge>
                  )}
                </div>
              </div>

              {!achievement.completed && (
                <div className="mt-2 space-y-1">
                  <Progress
                    value={
                      ((achievement.progress || 0) / achievement.target) * 100
                    }
                    className="h-1"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Récompense:</span>
                    <span>
                      {achievement.reward_coins} 🪙 + {achievement.reward_gems}{' '}
                      💎
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {achievements.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Star className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Aucun succès disponible</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
