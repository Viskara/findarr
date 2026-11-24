import type { Media } from '@findarr/shared/media';
import { useTranslation } from 'react-i18next';

import { DashboardHero } from '../components/dashboard/DashboardHero';
import { HomeSearch } from '../components/dashboard/HomeSearch';
import { ListsQuickLinks } from '../components/dashboard/ListsQuickLinks';
import { NewlyAvailableSection } from '../components/dashboard/NewlyAvailableSection';
import { PageContainer } from '../components/ui/PageContainer';
import { PageHeader } from '../components/ui/PageHeader';
import { useDashboardData } from '../hooks/useDashboardData';
import { useMediaNavigation } from '../hooks/useMediaNavigation';
import { useSession } from '../hooks/useSession';

export function DashboardPage() {
  const { t } = useTranslation();
  const { goTo, goToMedia, goToSearch } = useMediaNavigation();
  const { user } = useSession();
  const dashboard = useDashboardData();

  const handleSelectItem = (item: Media) => {
    goToMedia(item);
  };

  return (
    <PageContainer>
      <div className="space-y-8 md:space-y-10">
        <PageHeader
          title={t('dashboard.welcomeBack', { name: user?.displayName })}
          description={t('dashboard.description')}
        />

        <HomeSearch onSearch={goToSearch} />

        <ListsQuickLinks lists={dashboard.lists} />

        <NewlyAvailableSection
          title={t('dashboard.requestsInProgress')}
          results={dashboard.requestedResults}
          loading={dashboard.loadingRequested}
          onSelectItem={handleSelectItem}
          showStatus
          hideWhenEmpty
        />

        <NewlyAvailableSection
          results={dashboard.availableResults}
          loading={dashboard.loadingAvailable}
          onSelectItem={handleSelectItem}
        />

        <DashboardHero
          nextMedia={dashboard.nextMedia}
          heroError={dashboard.heroError}
          loading={dashboard.loadingHero}
          onNavigate={goTo}
        />
      </div>
    </PageContainer>
  );
}
