import type { ReactNode } from 'react';

type CollectionNoticeProps = {
  children: ReactNode;
  title?: string;
};

export const CollectionNotice = ({
  children,
  title = 'Before you add information',
}: CollectionNoticeProps) => (
  <aside className="collection-notice" aria-label={title}>
    <strong>{title}</strong>
    <p>{children}</p>
    <p>
      See <a href={`${import.meta.env.BASE_URL}privacy`}>Privacy</a> and{' '}
      <a href={`${import.meta.env.BASE_URL}terms`}>Terms</a>.
    </p>
  </aside>
);
