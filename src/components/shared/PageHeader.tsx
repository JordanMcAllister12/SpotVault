import { useMediaQuery } from '@/hooks/useMediaQuery';
import { StoreHeader } from '@/components/store/storeTokens';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function PageHeader({ icon, title, subtitle, children }: PageHeaderProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  if (isMobile) return null;
  return (
    <StoreHeader icon={icon} title={title} subtitle={subtitle ?? ''}>
      {children}
    </StoreHeader>
  );
}
