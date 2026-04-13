import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Volume2, VolumeX } from 'lucide-react';
import { useAudio } from '@/contexts/AudioContext';

export const SoundSettings = () => {
  const { soundEnabled, setSoundEnabled, soundVolume, setSoundVolume } =
    useAudio();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          Effets sonores
        </CardTitle>
        <CardDescription>Contrôlez le volume des sons du jeu</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle principal */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/20">
          <div className="space-y-0.5">
            <Label htmlFor="sound-enabled" className="text-base font-medium">
              Activer les sons
            </Label>
            <p className="text-sm text-muted-foreground">
              Active tous les effets sonores du jeu
            </p>
          </div>
          <Switch
            id="sound-enabled"
            checked={soundEnabled}
            onCheckedChange={setSoundEnabled}
          />
        </div>

        {soundEnabled && (
          <div className="space-y-4 animate-in fade-in-50 duration-300">
            {/* Contrôle du volume */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="sound-volume"
                  className="text-sm font-medium flex items-center gap-2"
                >
                  {soundVolume > 0 ? (
                    <Volume2 className="h-4 w-4 text-primary" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  )}
                  Volume: {soundVolume}%
                </Label>
              </div>
              <Slider
                id="sound-volume"
                min={0}
                max={100}
                step={5}
                value={[soundVolume]}
                onValueChange={(value) => setSoundVolume(value[0])}
                className="w-full"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
