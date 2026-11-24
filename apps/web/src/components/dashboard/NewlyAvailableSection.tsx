import type { Media } from '@findarr/shared/media';
import { useTranslation } from 'react-i18next';

import { MediaPosterStrip } from '../media/MediaPosterStrip';

interface NewlyAvailableSectionProps {
  results: Media[];
  loading: boolean;
  onSelectItem: (item: Media) => void;
  title?: string;
  showStatus?: boolean;
  emptyMessage?: string;
  /** Render nothing at all when there is nothing to show. */
  hideWhenEmpty?: boolean;
}

export function NewlyAvailableSection({
  results,
  loading,
  onSelectItem,
  title,
  showStatus = false,
  emptyMessage,
  hideWhenEmpty = false,
}: NewlyAvailableSectionProps) {
  const { t } = useTranslation();

  if (hideWhenEmpty && !loading && results.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl font-semibold text-white md:text-2xl">
          {title ?? t('media.newlyAvailable')}
        </h2>
      </div>

      <MediaPosterStrip
        loading={loading}
        onSelectItem={onSelectItem}
        results={results}
        showStatus={showStatus}
        {...(emptyMessage === undefined ? {} : { emptyMessage })}
      />
    </section>
  );
}
