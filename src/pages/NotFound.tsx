import { useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Home, Sprout, TrendingUp, User, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.warn(
      '404: User attempted to access non-existent route:',
      location.pathname
    );
  }, [location.pathname]);

  const getContextualMessage = (pathname: string) => {
    if (pathname.includes('garden'))
      return "Cette parcelle n'existe pas dans votre jardin.";
    if (pathname.includes('upgrade'))
      return 'Cette amélioration semble introuvable.';
    if (pathname.includes('profile'))
      return "Ce profil n'a pas pu être trouvé.";
    if (pathname.includes('store'))
      return "Cette section du magasin n'existe pas.";
    return "Cette page n'existe pas dans votre jardin.";
  };

  const getSuggestedAction = (pathname: string) => {
    if (pathname.includes('garden'))
      return 'Retournez à votre jardin principal';
    if (pathname.includes('upgrade'))
      return 'Explorez les améliorations disponibles';
    if (pathname.includes('profile')) return 'Consultez votre profil';
    if (pathname.includes('store')) return 'Visitez le magasin';
    return 'Retournez à votre jardin';
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <Card className="w-full max-w-lg bg-card/90 backdrop-blur-sm border border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Sprout className="w-10 h-10 text-primary" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold text-foreground mb-2">
              404 - Page introuvable
            </CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              {getContextualMessage(location.pathname)}
            </CardDescription>
            <p className="text-sm text-muted-foreground mt-2">
              {getSuggestedAction(location.pathname)} ou explorez les autres
              sections.
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Button asChild variant="default" className="w-full">
              <Link to="/garden">
                <Home className="w-4 h-4 mr-2" />
                Jardin
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link to="/upgrades">
                <TrendingUp className="w-4 h-4 mr-2" />
                Améliorations
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link to="/store">
                <Sprout className="w-4 h-4 mr-2" />
                Magasin
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link to="/profile">
                <User className="w-4 h-4 mr-2" />
                Profil
              </Link>
            </Button>
          </div>

          <Button
            onClick={() => window.history.back()}
            variant="secondary"
            className="w-full mt-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>

          <div className="text-center pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              Route demandée :{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">
                {location.pathname}
              </code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
