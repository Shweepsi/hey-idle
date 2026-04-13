import { Button } from '@/components/ui/button';
import { ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

interface TouchOptimizedButtonProps extends ButtonProps {
  touchSize?: 'sm' | 'md' | 'lg';
}

export function TouchOptimizedButton({
  className,
  touchSize = 'md',
  children,
  ...props
}: TouchOptimizedButtonProps) {
  const { isTouch } = useResponsiveLayout();

  const touchSizeClasses = {
    sm: 'min-h-[44px] min-w-[44px] px-4 py-2',
    md: 'min-h-[48px] min-w-[48px] px-6 py-3',
    lg: 'min-h-[56px] min-w-[56px] px-8 py-4',
  };

  return (
    <Button
      className={cn(
        // Base styles toujours appliqués
        'select-none transition-all duration-200',
        // Styles tactiles conditionnels
        isTouch && [
          touchSizeClasses[touchSize],
          'active:scale-95 active:bg-primary/90',
          'tap-highlight-transparent',
          // Amélioration de la zone de touch sur petits écrans
          'touch-sm:text-sm touch-sm:px-3 touch-sm:py-2',
        ],
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
