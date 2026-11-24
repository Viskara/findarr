import type { MdblistList } from '@findarr/shared/mdblist';
import { useEffect, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { mdblistService } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

interface AddListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (lists: MdblistList[]) => void;
}

interface Failure {
  url: string;
  message: string;
}

function parseLinks(text: string): string[] {
  return [...new Set(text.split(/[\s,]+/u).filter((part) => part !== ''))];
}

export function AddListModal({ isOpen, onClose, onAdded }: AddListModalProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failures, setFailures] = useState<Failure[]>([]);

  useEffect(() => {
    if (isOpen) {
      setText('');
      setFailures([]);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', closeOnEscape);
    }
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const links = parseLinks(text);

  const handleSubmit = async (event: ChangeEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (links.length === 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setFailures([]);

    const added: MdblistList[] = [];
    const failed: Failure[] = [];

    for (const url of links) {
      try {
        // oxlint-disable-next-line no-await-in-loop
        added.push(await mdblistService.addList({ url }));
      } catch (error) {
        failed.push({ url, message: getApiErrorMessage(error) });
      }
    }

    setIsSubmitting(false);

    if (added.length > 0) {
      onAdded(added);
    }

    if (failed.length === 0) {
      onClose();
      return;
    }

    // Keep only the links that failed so they can be fixed and retried.
    setText(failed.map((failure) => failure.url).join('\n'));
    setFailures(failed);
  };

  return createPortal(
    <div className="fixed inset-0 z-10000 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 cursor-pointer bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <Card
        variant="solid"
        padding="none"
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-list-title"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div className="min-w-0 flex-1 pr-2">
            <h2 id="add-list-title" className="text-lg font-bold text-white">
              {t('lists.add.title')}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">{t('lists.add.description')}</p>
          </div>
          <Button
            onClick={onClose}
            variant="icon"
            size="sm"
            className="shrink-0"
            aria-label={t('common.close')}
          >
            <Icon name="close" />
          </Button>
        </div>

        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            <label className="block text-sm font-medium text-gray-300" htmlFor="add-list-links">
              {t('lists.add.label')}
            </label>
            <textarea
              id="add-list-links"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
              }}
              rows={5}
              placeholder={t('lists.add.placeholder')}
              className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 transition-colors hover:border-zinc-700 focus:border-transparent focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />

            {failures.length > 0 && (
              <ul className="space-y-2" aria-live="polite">
                {failures.map((failure) => (
                  <li
                    key={failure.url}
                    className="rounded-lg border border-red-800/60 bg-red-950/30 px-3 py-2 text-sm text-red-300"
                  >
                    <span className="block truncate font-medium">{failure.url}</span>
                    <span className="block text-xs text-red-300/80">{failure.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-800 p-4">
            <Button type="button" onClick={onClose} variant="secondary" size="sm">
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isSubmitting}
              disabled={links.length === 0}
            >
              {isSubmitting
                ? t('lists.add.adding')
                : t('lists.add.submit', { count: links.length })}
            </Button>
          </div>
        </form>
      </Card>
    </div>,
    document.body,
  );
}
