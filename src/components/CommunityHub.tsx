import type { ComponentProps } from 'react';
import { SharedInnerHub } from '@/components/SharedInnerHub';

export function CommunityHub(props: ComponentProps<typeof SharedInnerHub>) {
  return <SharedInnerHub {...props} />;
}
