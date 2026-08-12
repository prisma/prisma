import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold uppercase',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-foreground',
        success: 'bg-success text-white',
        warning: 'bg-warning text-white',
        destructive: 'bg-destructive text-white',
        outline: 'border border-border text-foreground',
        muted: 'bg-muted/20 text-muted',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
