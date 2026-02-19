import * as React from 'react';
import styles from '../../Clients/RightPanelTabs/SummaryTab.module.scss';
import type { EntitySelection } from '../../Clients/RightPanelTabs/EntitiesTab';

const TERM_GROUP_ID = 'cadcb7a6-fcde-4b81-a893-6071c3dd2cbb';
const CLIENT_TERM_SET_ID = 'e15c7ba0-e449-437f-bb70-b35bc582edda';
const ENTITY_TERM_SET_ID = '63f8136b-40cf-4d43-890a-73d4959c5a68';
const BANK_TERM_SET_ID = 'e15c7ba0-e449-437f-bb70-b35bc582edda';

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
  const [bankTerms, setBankTerms] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  /* ================= TAXONOMY & DATA HELPERS ================= */

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
      const parts = value.map(v => formatScalar(v)).filter(Boolean).filter(v => v !== '—');
      return parts.length ? parts.join(', ') : '—';
    }
    if (typeof value === 'object') {
      const label = (value as any).Label || (value as any).Title || (value as any).TermGuid || (value as any).name;
      if (label) return String(label);
    }
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

  const getPeopleLabels = (value: any): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map(v => v?.Title || v?.name || v?.Label || v?.Email || v?.EMail).filter(Boolean);
    }
    if (typeof value === 'object') {
      const name = value.Title || value.name || value.Label || value.Email || value.EMail;
      return name ? [name] : [];
    }
    if (typeof value === 'string') return [value];
    return [];
  };

  const renderBulletList = (items: string[]) =>
    items.length ? (
      <ul className={styles.list}>
        {items.map((itemText, i) => (
          <li key={i}>{itemText}</li>
        ))}
      </ul>
    ) : null;

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
    const resp = await fetch(
      `${webUrl}/_api/v2.1/termstore/groups('${TERM_GROUP_ID}')/sets('${setId}')/terms`,
      { headers: { Accept: 'application/json' } }
    );
    const data = await resp.json();
    const map: Record<string, string> = {};
    (data.value || []).forEach((t: any) => {
      if (guids.has(t.id.toLowerCase())) {
        const label = t.labels?.find((l: any) => l.isDefault)?.name || t.labels?.[0]?.name;
        if (label) map[t.id.toLowerCase()] = label;
      }
    });
    setState(map);
  };

  /* ================= LOAD SUMMARY ================= */

  const loadSummary = async () => {
    if (!entity?.id) {
      setItem(null);
      setClientTerms({});
      setEntityTerms({});
      setBankTerms({});
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // 1. Instantly clear the item to force the "Loading..." UI state
      setItem(null); 

      const fetchJson = async (url: string) => {
        const resp = await fetch(url, { headers: { Accept: 'application/json;odata=nometadata' } });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      };

      const data = await fetchJson(
        `${webUrl}/_api/web/lists/getByTitle('Entities')/items(${entity.id})?$select=*,Members/Title,Manager/Title,Setter/Title,Beneficiary/Title,Trustee/Title&$expand=Members,Manager,Setter,Beneficiary,Trustee`
      );

      const clientGuids = new Set<string>();
      const entityGuids = new Set<string>();
      const bankGuids = new Set<string>(); 

      collectTermGuids(data.RelatedClient, clientGuids);
      collectTermGuids(data.Entity, entityGuids);
      collectTermGuids(data.Bank, bankGuids); 

      // 2. Await all the text labels from the Term Store BEFORE continuing
      await Promise.all([
        loadTermSet(clientGuids, CLIENT_TERM_SET_ID, setClientTerms),
        loadTermSet(entityGuids, ENTITY_TERM_SET_ID, setEntityTerms),
        loadTermSet(bankGuids, BANK_TERM_SET_ID, setBankTerms) 
      ]);

      // 3. Render the data! No more flashing IDs.
      setItem(data); 

    } catch (err) {
      console.error('Entity summary load error', err);
      setError('Failed to load entity summary');
      setItem(null);
      setClientTerms({});
      setEntityTerms({});
      setBankTerms({});
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadSummary();
  }, [entity?.id, webUrl]);

  if (loading) return <div className={styles.loading}>Loading entity summary…</div>;
  if (error) return <div className={styles.loading}>{error}</div>;
  if (!item) return <div className={styles.loading}>No entity details found</div>;

  /* ================= SECTIONS DATA ================= */

  const coreFields = [
    { label: 'Entity Name', value: entity?.label || renderTaxonomy(item.Entity, entityTerms) },
    { label: 'Entity Aliases', value: item.EntityAliases },
    { label: 'Federal Tax ID', value: item.FederalTaxID },
    { label: 'Bank', value: renderTaxonomy(item.Bank, bankTerms) },
    { label: 'Account No', value: item.AccountNo },
    { label: 'Routing No', value: item.RoutingNo },
    { label: 'Entity Description', value: stripHtml(item.EntityDesc) }
  ].filter(f => hasValue(f.value));

  const peopleSection =
    getPeopleLabels(item.Members).length > 0 ||
    getPeopleLabels(item.Manager).length > 0 ||
    getPeopleLabels(item.Setter).length > 0 ||
    getPeopleLabels(item.Trustee).length > 0 ||
    getPeopleLabels(item.Beneficiary).length > 0;

  const relationshipSection = getTaxonomyLabels(item.RelatedClient, clientTerms).length > 0;

  /* ================= RENDER ================= */

  return (
    <div className={styles.summaryRoot}>
      
      {/* SECTION 1: CORE DETAILS */}
      {coreFields.length > 0 && (
        <div className={styles.section}>
          {chunk(coreFields, 3).map((row, i) => (
            <div className={styles.rowWrapper} key={`core-${i}`}>
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
      )}

      {/* SECTION 2: PEOPLE / ROLES */}
      {peopleSection && (
        <>
          <div className={styles.separator} />
          <div className={styles.section}>
            <div className={styles.rowWrapper}>
              <div className={styles.row}>
                
                {getPeopleLabels(item.Members).length > 0 && (
                  <div className={styles.cell}>
                    <span className={styles.label}>Members</span>
                    {renderBulletList(getPeopleLabels(item.Members))}
                  </div>
                )}

                {getPeopleLabels(item.Manager).length > 0 && (
                  <div className={styles.cell}>
                    <span className={styles.label}>Manager</span>
                    {renderBulletList(getPeopleLabels(item.Manager))}
                  </div>
                )}

                {getPeopleLabels(item.Setter).length > 0 && (
                  <div className={styles.cell}>
                    <span className={styles.label}>Setter</span>
                    {renderBulletList(getPeopleLabels(item.Setter))}
                  </div>
                )}

                {getPeopleLabels(item.Trustee).length > 0 && (
                  <div className={styles.cell}>
                    <span className={styles.label}>Trustee</span>
                    {renderBulletList(getPeopleLabels(item.Trustee))}
                  </div>
                )}

                {getPeopleLabels(item.Beneficiary).length > 0 && (
                  <div className={styles.cell}>
                    <span className={styles.label}>Beneficiary</span>
                    {renderBulletList(getPeopleLabels(item.Beneficiary))}
                  </div>
                )}

              </div>
            </div>
          </div>
        </>
      )}

      {/* SECTION 3: RELATIONSHIPS */}
      {relationshipSection && (
        <>
          <div className={styles.separator} />
          <div className={styles.section}>
            <div className={styles.rowWrapper}>
              <div className={styles.row}>
                {getTaxonomyLabels(item.RelatedClient, clientTerms).length > 0 && (
                  <div className={styles.cell}>
                    <span className={styles.label}>Related Clients</span>
                    {renderBulletList(getTaxonomyLabels(item.RelatedClient, clientTerms))}
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

export default EntitySummaryTab;