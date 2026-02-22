import * as React from 'react';
import styles from './SummaryTab.module.scss';
import {
  TENANT_CONFIG,
  buildListItemsApiUrl,
  fetchTermLabelMap
} from '../../../config/tenantConfig';

interface SummaryTabProps {
  webUrl: string;
  clientId: number;
  clientName?: string | null;
}

const chunk = <T,>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

const SummaryTab: React.FC<SummaryTabProps> = ({ webUrl, clientId, clientName }) => {
  const [item, setItem] = React.useState<any>(null);
  const [clientTerms, setClientTerms] = React.useState<Record<string, string>>({});
  const [entityTerms, setEntityTerms] = React.useState<Record<string, string>>({});

  /* ================= TAXONOMY HELPERS ================= */

  const parseTaxonomyEntries = (val: any): Array<{ guid: string; label: string }> => {
    if (!val) return [];

    if (typeof val === 'string') {
      const entries: Array<{ guid: string; label: string }> = [];

      val
        .split(';#')
        .map(token => token.trim())
        .filter(Boolean)
        .forEach(token => {
          if (token.includes('|')) {
            const parts = token.split('|');
            const label = String(parts[0] || '').trim();
            const guid = String(parts[1] || '').trim().toLowerCase();

            if (TENANT_CONFIG.patterns.guidExact.test(guid)) {
              entries.push({ guid, label });
            }
            return;
          }

          const guid = token.toLowerCase();
          if (TENANT_CONFIG.patterns.guidExact.test(guid)) {
            entries.push({ guid, label: '' });
          }
        });

      return entries;
    }

    if (Array.isArray(val)) {
      const nested: Array<{ guid: string; label: string }> = [];
      val.forEach(v => {
        nested.push(...parseTaxonomyEntries(v));
      });
      return nested;
    }

    if (typeof val === 'object') {
      const guid = String(
        val.TermGuid || val.termGuid || val.id || val.Id || ''
      )
        .trim()
        .toLowerCase();
      const label = String(
        val.Label || val.label || val.Title || val.name || ''
      ).trim();

      if (TENANT_CONFIG.patterns.guidExact.test(guid)) {
        return [{ guid, label }];
      }
      if (label) {
        return [{ guid: '', label }];
      }
    }

    return [];
  };

  const isReadableTaxonomyLabel = (value: string): boolean => {
    const text = String(value || '').trim();
    if (!text) return false;
    if (TENANT_CONFIG.patterns.guidExact.test(text)) return false;
    if (/^\d+$/.test(text)) return false;
    return true;
  };

  const collectTermGuids = (val: any, set: Set<string>) => {
    parseTaxonomyEntries(val).forEach(entry => {
      if (entry.guid) {
        set.add(entry.guid);
      }
    });
  };

  const getTaxonomyLabels = (val: any, map: Record<string, string>): string[] => {
    const seen = new Set<string>();
    const resolved: string[] = [];

    parseTaxonomyEntries(val).forEach(entry => {
      const mapped = entry.guid ? map[entry.guid] : '';
      const fallback = isReadableTaxonomyLabel(entry.label) ? entry.label : '';
      const value = mapped || fallback || entry.guid;
      if (!value) return;

      const key = value.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      resolved.push(value);
    });

    return resolved;
  };

  const renderTaxonomy = (val: any, map: Record<string, string>): string =>
    getTaxonomyLabels(val, map).join(', ');

  const renderClientTaxonomy = (val: any) => renderTaxonomy(val, clientTerms);
  const renderEntityTaxonomy = (val: any) => renderTaxonomy(val, entityTerms);
  const getClientTaxonomyLabels = (val: any) => getTaxonomyLabels(val, clientTerms);
  const getEntityTaxonomyLabels = (val: any) => getTaxonomyLabels(val, entityTerms);

  const renderBulletList = (items: string[]) =>
    items.length ? (
      <ul className={styles.list}>
        {items.map((itemText, i) => (
          <li key={i}>{itemText}</li>
        ))}
      </ul>
    ) : null;

  /* ================= UI HELPERS ================= */

  const renderMultiline = (v?: string) =>
    v ? (
      v.split('\n').map((l, i) => (
        <React.Fragment key={i}>
          {l}
          <br />
        </React.Fragment>
      ))
    ) : null;

  const formatDate = (value?: string | number | Date) => {
    if (!value) return value;

    let date: Date | null = null;

    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'number') {
      date = new Date(value);
    } else if (typeof value === 'string') {
      const spMatch = value.match(/Date\((\d+)\)/);
      date = spMatch ? new Date(Number(spMatch[1])) : new Date(value);
    }

    if (!date || Number.isNaN(date.getTime())) return value;

    const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const day = date.toLocaleDateString('en-US', { day: '2-digit', timeZone: 'UTC' });
    const year = date.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'UTC' });

    return `${month}-${day}-${year}`;
  };

  const getListLabels = (value: any): string[] => {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value
        .map(v => v?.Title || v?.LookupValue || v?.Label || v?.label)
        .filter(Boolean);
    }

    if (typeof value === 'object') {
      if (Array.isArray(value.results)) {
        return value.results
          .map((v: any) => v?.Title || v?.LookupValue || v?.Label || v?.label)
          .filter(Boolean);
      }
      const single = value.Title || value.LookupValue || value.Label || value.label;
      return single ? [single] : [];
    }

    if (typeof value === 'string') {
      const taxonomyLabels = value
        .split(';#')
        .filter(v => v.includes('|'))
        .map(v => v.split('|')[0])
        .filter(Boolean);
      if (taxonomyLabels.length) return taxonomyLabels;
      return [value];
    }

    return [];
  };

  const renderList = (value: any) => {
    const labels = getListLabels(value);
    return labels.length ? (
      <ul className={styles.list}>
        {labels.map((label, i) => (
          <li key={i}>{label}</li>
        ))}
      </ul>
    ) : null;
  };

  const hasValue = (v: any) => {
    if (v === null || v === undefined || v === '' || v === '—') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  };

  /* ================= TERM STORE ================= */

  const loadTermSet = async (
    guids: Set<string>,
    setId: string,
    setState: React.Dispatch<React.SetStateAction<Record<string, string>>>
  ) => {
    if (!guids.size) {
      setState({});
      return;
    }
    const map = await fetchTermLabelMap(webUrl, setId, guids);
    setState(map);
  };

  /* ================= LOAD CLIENT ================= */

  const loadSummary = async () => {
    // 1. Instantly clear the item so the component goes into "Loading..." state
    setItem(null); 

    const resp = await fetch(
      `${buildListItemsApiUrl(webUrl, TENANT_CONFIG.lists.clients.title)}(${clientId})?` +
        `$select=${TENANT_CONFIG.lists.clients.queries.summarySelect}&` +
        `$expand=${TENANT_CONFIG.lists.clients.queries.summaryExpand}`,
      { headers: { Accept: 'application/json;odata=nometadata' } }
    );

    const data = await resp.json();
    
    // NOTE: We do NOT call setItem(data) here anymore! We wait for the terms to finish.

    const clientGuids = new Set<string>();
    const entityGuids = new Set<string>();

    collectTermGuids(data.Client, clientGuids);
    collectTermGuids(data.RelatedClient, clientGuids);
    collectTermGuids(data.RelatedEntity, entityGuids);

    // 2. Wait for all taxonomy labels to download fully
    await Promise.all([
      loadTermSet(clientGuids, TENANT_CONFIG.termStore.sets.clients, setClientTerms),
      loadTermSet(entityGuids, TENANT_CONFIG.termStore.sets.entities, setEntityTerms)
    ]);

    // 3. Now that everything is 100% loaded, render the component. No more GUID flashing!
    setItem(data);
  };

  React.useEffect(() => {
    void loadSummary();
  }, [clientId]);

  if (!item) {
    return <div className={styles.loading}>Loading summary…</div>;
  }

  /* ================= SECTIONS ================= */

  const coreFields = [
    {
      label: 'Client Name',
      value: (() => {
        const headerName = String(clientName || '').trim();
        if (isReadableTaxonomyLabel(headerName)) {
          return headerName;
        }

        const termName = renderClientTaxonomy(item.Client);
        if (isReadableTaxonomyLabel(termName)) {
          return termName;
        }

        const alias = String(item.EntityAliases || '').trim();
        if (isReadableTaxonomyLabel(alias)) {
          return alias;
        }

        const title = String(item.Title || '').trim();
        if (isReadableTaxonomyLabel(title)) {
          return title;
        }

        return termName;
      })()
    },
    { label: 'Aliases', value: item.EntityAliases },
    { label: 'Address', value: renderMultiline(item.WorkAddress) },
    { label: 'Marital Status', value: item.MaritalStatus },
    { label: 'Generation', value: item.Generation },
    { label: 'Birthday', value: formatDate(item.Birthday) },
    { label: 'Federal Tax ID', value: item.FederalTaxID },
    { label: 'Drivers License', value: item.DriversLicense },
    { label: 'P.O. Box', value: item.POBox },
    { label: 'DL State Of Issue', value: item.DLStateOfIssue },
    { label: 'DL Expire', value: formatDate(item.DLExpire) }
  ].filter(f => hasValue(f.value));

  const familySection =
    getListLabels(item.Parents).length > 0 ||
    getListLabels(item.Siblings).length > 0 ||
    getListLabels(item.Children).length > 0 ||
    hasValue(item.MinorChild);

  const relationshipSection = getTaxonomyLabels(item.RelatedClient, clientTerms).length > 0 || getTaxonomyLabels(item.RelatedEntity, entityTerms).length > 0;

  /* ================= RENDER ================= */

  return (
    <div className={styles.summaryRoot}>
      <div className={styles.section}>
        {chunk(coreFields, 3).map((row, i) => (
          <div className={styles.rowWrapper} key={i}>
            <div className={styles.row}>
              {row.map(f => (
                <div className={styles.cell} key={f.label}>
                  <span className={styles.label}>{f.label}</span>
                  <div className={styles.value}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {familySection && (
        <>
          <div className={styles.separator} />
          <div className={styles.section}>
            <div className={styles.rowWrapper}>
              <div className={styles.row}>
                {getListLabels(item.Parents).length > 0 && (
                  <div className={styles.cell}>
                    <span className={styles.label}>Parents</span>
                    {renderList(item.Parents)}
                  </div>
                )}

                {getListLabels(item.Siblings).length > 0 && (
                  <div className={styles.cell}>
                    <span className={styles.label}>Siblings</span>
                    {renderList(item.Siblings)}
                  </div>
                )}

                {getListLabels(item.Children).length > 0 && (
                  <div className={styles.cell}>
                    <span className={styles.label}>Children</span>
                    {renderList(item.Children)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {relationshipSection && (
        <>
          <div className={styles.separator} />
          <div className={styles.section}>
            <div className={styles.rowWrapper}>
              <div className={styles.row}>
                {getTaxonomyLabels(item.RelatedClient, clientTerms).length > 0 && (
                  <div className={styles.cell}>
                    <span className={styles.label}>Related Clients</span>
                    {renderBulletList(getClientTaxonomyLabels(item.RelatedClient))}
                  </div>
                )}

                {getTaxonomyLabels(item.RelatedEntity, entityTerms).length > 0 && (
                  <div className={styles.cell}>
                    <span className={styles.label}>Related Entities</span>
                    {renderBulletList(getEntityTaxonomyLabels(item.RelatedEntity))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SummaryTab;
