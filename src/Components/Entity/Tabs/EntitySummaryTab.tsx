import * as React from 'react';
import styles from '../../Clients/RightPanelTabs/SummaryTab.module.scss';
import type { EntitySelection } from '../../Clients/RightPanelTabs/EntitiesTab';

const TERM_GROUP_ID = 'cadcb7a6-fcde-4b81-a893-6071c3dd2cbb';
const CLIENT_TERM_SET_ID = 'e15c7ba0-e449-437f-bb70-b35bc582edda';
const ENTITY_TERM_SET_ID = '63f8136b-40cf-4d43-890a-73d4959c5a68';

interface EntitySummaryTabProps {
  webUrl: string;
  entity: EntitySelection | null;
}

const chunk = <T,>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

const EntitySummaryTab: React.FC<EntitySummaryTabProps> = ({ webUrl, entity }) => {
  const [item, setItem] = React.useState<any>(null);
  const [clientTerms, setClientTerms] = React.useState<Record<string, string>>({});
  const [entityTerms, setEntityTerms] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const collectTermGuids = (value: any, set: Set<string>) => {
    if (!value) return;

    if (typeof value === 'string') {
      value
        .split(';#')
        .filter(v => v.includes('|'))
        .forEach(v => {
          const guid = v.split('|')[1];
          if (guid) set.add(guid.toLowerCase());
        });
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(v => collectTermGuids(v, set));
      return;
    }

    if (value.TermGuid) {
      set.add(String(value.TermGuid).toLowerCase());
    }
  };

  const getTaxonomyLabels = (value: any, map: Record<string, string>): string[] => {
    const guids = new Set<string>();
    collectTermGuids(value, guids);
    if (!guids.size) return [];

    return Array.from(guids)
      .map(g => map[g] || g)
      .filter(Boolean);
  };

  const renderTaxonomy = (value: any, map: Record<string, string>): string =>
    getTaxonomyLabels(value, map).join(', ');

  const formatScalar = (value: any): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value).trim();
      return text.length ? text : '—';
    }
    if (Array.isArray(value)) {
      const parts = value
        .map(v => formatScalar(v))
        .filter(Boolean)
        .filter(v => v !== '—');
      return parts.length ? parts.join(', ') : '—';
    }
    if (typeof value === 'object') {
      const label = (value as any).Label || (value as any).Title || (value as any).TermGuid || (value as any).name;
      if (label) return String(label);
    }
    return '—';
  };

  const renderPeople = (value: any): string => {
    if (!value) return '—';
    if (Array.isArray(value)) {
      const names = value
        .map(v => v?.Title || v?.name || v?.Label || v?.Email || v?.EMail)
        .filter(Boolean);
      return names.length ? names.join(', ') : '—';
    }
    if (typeof value === 'object') {
      const name = value.Title || value.name || value.Label || value.Email || value.EMail;
      return name || '—';
    }
    if (typeof value === 'string') return value;
    return '—';
  };

  const stripHtml = (value: any): string => {
    const text = formatScalar(value);
    if (!text || text === '—') return '—';
    const tmp = document.createElement('div');
    tmp.innerHTML = text;
    const clean = tmp.textContent || tmp.innerText || '';
    return clean.trim() || '—';
  };

  const hasValue = (v: any) =>
    v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);

  const loadTermSet = async (
    guids: Set<string>,
    setId: string,
    setState: React.Dispatch<React.SetStateAction<Record<string, string>>>
  ) => {
    if (!guids.size) {
      setState({});
      return;
    }

    const resp = await fetch(
      `${webUrl}/_api/v2.1/termstore/groups('${TERM_GROUP_ID}')/sets('${setId}')/terms`,
      { headers: { Accept: 'application/json' } }
    );
    const data = await resp.json();
    const map: Record<string, string> = {};

    (data.value || []).forEach((t: any) => {
      if (guids.has(t.id.toLowerCase())) {
        const label =
          t.labels?.find((l: any) => l.isDefault)?.name ||
          t.labels?.[0]?.name;
        if (label) map[t.id.toLowerCase()] = label;
      }
    });

    setState(map);
  };

  const loadSummary = async () => {
    if (!entity?.id) {
      setItem(null);
      setClientTerms({});
      setEntityTerms({});
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const fetchJson = async (url: string) => {
        const resp = await fetch(url, {
          headers: { Accept: 'application/json;odata=nometadata' }
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      };

      const data = await fetchJson(
        `${webUrl}/_api/web/lists/getByTitle('Entities')/items(${entity.id})?$select=*`
      );

      setItem(data);

      const clientGuids = new Set<string>();
      const entityGuids = new Set<string>();
      collectTermGuids(data.RelatedClient, clientGuids);
      collectTermGuids(data.Entity, entityGuids);

      await Promise.all([
        loadTermSet(clientGuids, CLIENT_TERM_SET_ID, setClientTerms),
        loadTermSet(entityGuids, ENTITY_TERM_SET_ID, setEntityTerms)
      ]);
    } catch (err) {
      console.error('Entity summary load error', err);
      setError('Failed to load entity summary');
      setItem(null);
      setClientTerms({});
      setEntityTerms({});
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadSummary();
  }, [entity?.id, webUrl]);

  if (loading) {
    return <div className={styles.loading}>Loading entity summary…</div>;
  }

  if (error) {
    return <div className={styles.loading}>{error}</div>;
  }

  if (!item) {
    return <div className={styles.loading}>No entity details found</div>;
  }

  const fields = [
    { label: 'Entity Name', value: entity?.label || renderTaxonomy(item.Entity, entityTerms) },
    // { label: 'Entity Term GUID', value: entity?.termGuid },
    { label: 'Entity Aliases', value: item.EntityAliases },
    { label: 'Related Clients', value: renderTaxonomy(item.RelatedClient, clientTerms) },
    { label: 'Federal Tax ID', value: item.FederalTaxID },
    { label: 'Bank', value: item.Bank },
    { label: 'Account No', value: item.AccountNo },
    { label: 'Routing No', value: item.RoutingNo },
    { label: 'Entity Description', value: stripHtml(item.EntityDesc) },
    { label: 'Members', value: renderPeople(item.Members) },
    { label: 'Setter', value: renderPeople(item.Setter) },
    { label: 'Trustee', value: renderPeople(item.Trustee) },
    { label: 'Beneficiary', value: renderPeople(item.Beneficiary) }
  ].filter(f => hasValue(f.value));

  return (
    <div className={styles.summaryRoot}>
      <div className={styles.section}>
        {chunk(fields, 3).map((row, i) => (
          <div className={styles.rowWrapper} key={i}>
            <div className={styles.row}>
              {row.map(f => (
                <div className={styles.cell} key={f.label}>
                  <span className={styles.label}>{f.label}</span>
                  <div className={styles.value}>{formatScalar(f.value)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EntitySummaryTab;
