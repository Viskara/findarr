import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '../ui/Icon';
import { Input } from '../ui/Input';

interface HomeSearchProps {
  onSearch: (query: string) => void;
}

export function HomeSearch({ onSearch }: HomeSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const handleSubmit = (event: ChangeEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed !== '') {
      onSearch(trimmed);
    }
  };

  return (
    <form onSubmit={handleSubmit} role="search">
      <Input
        variant="search"
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
        placeholder={t('catalog.searchPlaceholder')}
        aria-label={t('catalog.searchPlaceholder')}
        prefixIcon={<Icon name="search" />}
      />
    </form>
  );
}
