import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Minus, Plus, RotateCcw, Type } from 'lucide-react';
import { useFontSize, FontSize } from '@/hooks/useFontSize';

const fontSizeLabels: Record<FontSize, string> = {
  small: 'Petite',
  medium: 'Normale',
  large: 'Grande',
  'extra-large': 'Très grande',
};

export function FontSizeSelector() {
  const {
    fontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    canIncrease,
    canDecrease,
  } = useFontSize();

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center space-y-0 pb-4">
        <div className="flex items-center space-x-2">
          <Type className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-lg">Taille de Police</CardTitle>
            <CardDescription>
              Ajustez la taille du texte pour une meilleure lisibilité
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              Taille actuelle :
            </span>
            <Badge variant="secondary" className="text-sm">
              {fontSizeLabels[fontSize]}
            </Badge>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={resetFontSize}
            className="text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Réinitialiser
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={decreaseFontSize}
            disabled={!canDecrease}
            className="flex-1"
          >
            <Minus className="h-4 w-4 mr-1" />
            Diminuer
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={increaseFontSize}
            disabled={!canIncrease}
            className="flex-1"
          >
            <Plus className="h-4 w-4 mr-1" />
            Augmenter
          </Button>
        </div>

        <div className="p-3 bg-muted/30 rounded-lg border">
          <p className="text-sm text-muted-foreground mb-2">Aperçu :</p>
          <p className="font-medium">
            Ce texte montre la taille actuelle de la police.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Texte secondaire plus petit pour comparaison.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
