import { useCallback, useEffect, useState } from 'react';
import {
  createSharedTemplateLink,
  retrieveSharedTemplateLinks,
  revokeSharedTemplateLink,
  type SharedTemplateLinkRecord,
} from '../../data/repositories/budgetRepository';
import type { Category, TemplateWithItems } from '../../shared/types/domain';
import { Button } from '../../shared/ui/Button';

export const ShareTemplateForm = ({
  template,
  categories,
}: {
  template: TemplateWithItems;
  categories: Category[];
}) => {
  const [includeAmounts, setIncludeAmounts] = useState(false);
  const [expiryHours, setExpiryHours] = useState(168);
  const [links, setLinks] = useState<SharedTemplateLinkRecord[]>([]);
  const [created, setCreated] = useState<{ id: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      retrieveSharedTemplateLinks()
        .then(setLinks)
        .catch(() => setError('Existing template links could not be loaded.')),
    [],
  );
  useEffect(() => void refresh(), [refresh]);

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await createSharedTemplateLink({
        templateId: template.id,
        includeAmounts,
        expiryHours,
      });
      const url = `${window.location.origin}${import.meta.env.BASE_URL}template#${result.token}`;
      setCreated({ id: result.id, url });
      setCopied(false);
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'The template link could not be created.',
      );
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      setError('The link could not be copied. Select and copy it manually.');
    }
  };

  const revoke = async (id: string) => {
    setError(null);
    try {
      await revokeSharedTemplateLink(id);
      await refresh();
    } catch {
      setError('The template link could not be revoked.');
    }
  };

  return (
    <div className="share-template-form">
      <section className="share-template-preview" aria-labelledby="template-share-preview">
        <h3 id="template-share-preview">Recipient preview</h3>
        <p className="share-template-preview__summary">
          <strong>{template.name}</strong> · {template.template_items.length} items
        </p>
        <ul className="share-template-preview__items">
          {template.template_items.map((item) => (
            <li key={item.id}>
              <span className="share-template-preview__item-details">
                <strong>{item.name}</strong>
                <small>
                  {categories.find((category) => category.id === item.category_id)?.name ??
                    'Uncategorised'}
                </small>
              </span>
              <span className="share-template-preview__amount">
                {includeAmounts ? item.default_amount : 'Amount hidden'}
              </span>
            </li>
          ))}
        </ul>
        <p className="share-template-preview__privacy">
          Transactions, notes, goals, household members, profile details, and historical months are
          never included.
        </p>
      </section>
      <label className="check-row share-template-amount-option">
        <input
          type="checkbox"
          checked={includeAmounts}
          onChange={(event) => setIncludeAmounts(event.target.checked)}
        />
        <span>
          <strong>Include planned amounts</strong>
          <small>
            Amounts are private by default. Enable this only if you intend to publish them.
          </small>
        </span>
      </label>
      {includeAmounts && (
        <div className="inline-alert inline-alert--warning" role="alert">
          Anyone with the link can see these planned amounts until the link expires or is revoked.
        </div>
      )}
      <label className="field">
        <span className="field__label">Link expiry</span>
        <select
          value={expiryHours}
          onChange={(event) => setExpiryHours(Number(event.target.value))}
        >
          <option value={24}>24 hours</option>
          <option value={168}>7 days</option>
          <option value={720}>30 days</option>
          <option value={2160}>90 days</option>
        </select>
      </label>
      <Button loading={busy} onClick={() => void publish()}>
        Publish template snapshot
      </Button>
      {created && (
        <div className="copy-link-result">
          <input aria-label="Template share link" readOnly value={created.url} />
          <Button variant="secondary" onClick={() => void copyLink()}>
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      )}
      {error && (
        <div className="inline-alert inline-alert--error" role="alert">
          {error}
        </div>
      )}
      {links.filter((link) => link.templateId === template.id).length > 0 && (
        <section className="share-template-versions">
          <h3>Published versions</h3>
          <ul>
            {links
              .filter((link) => link.templateId === template.id)
              .map((link) => (
                <li key={link.id}>
                  <span>
                    Version {link.version} · expires {new Date(link.expiresAt).toLocaleDateString()}
                  </span>
                  {link.revokedAt ? (
                    <strong>Revoked</strong>
                  ) : (
                    <Button variant="ghost" onClick={() => void revoke(link.id)}>
                      Revoke
                    </Button>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
};
